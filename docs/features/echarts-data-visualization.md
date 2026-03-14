# ECharts 데이터 시각화 — 파이/라인/캔들스틱 차트

> Finnhub 과거 일봉 API + Mock 시뮬레이션으로 포트폴리오 비중·손익 추이·개별 종목 OHLCV를 시각화

## 개요

- **구현 목적**: 숫자 테이블만으로는 포트폴리오의 전체 상황을 직관적으로 파악하기 어려움. 파이차트(자산 분산), 라인차트(손익 추이), 캔들스틱(종목별 가격 흐름) 3종으로 데이터를 시각화하여 금융 대시보드 수준의 UX 제공
- **사용자 시나리오**: 종목 등록 → 테이블 아래에 파이차트(비중)+라인차트(손익 추이) 자동 표시 → 드롭다운에서 종목 선택 → 90일 캔들스틱 차트 표시

## 구현 내용

### 핵심 동작 흐름

```
[데이터 소스]
미국 주식: Finnhub /stock/candle API (실제 과거 일봉)
한국 주식: generateKrxMockCandles() (시드 기반 Mock 일봉)
        ↓
[데이터 조회 계층]
useStockCandles.ts (TanStack Query 래퍼 — 시장별 분기 + 캐싱)
        ↓
[데이터 가공 계층]
App.tsx — buildPortfolioHistoryFromMap()
  · 파이차트: priceMap × 수량 → 종목별 평가금액
  · 라인차트: 날짜별 종가 × 수량 → 포트폴리오 총 평가금액 → 매입금액 차감 → 손익
  · 캔들스틱: 일봉 데이터 직접 전달
        ↓
[차트 렌더링]
PieChart / LineChart / CandlestickChart (ECharts, React.memo)
```

### 주요 코드

#### 1. 과거 일봉 데이터 조회 — 시장별 전략 분기

```typescript
// hooks/useStockCandles.ts
export function useStockCandles(symbol: string, market: Market, days = 90) {
  return useQuery<CandlestickData[]>({
    queryKey: ['candles', symbol, market, days],
    queryFn: () => {
      if (market === 'KR') {
        return Promise.resolve(generateKrxMockCandles(symbol, days));
      }
      const now = Math.floor(Date.now() / 1000);
      const from = now - days * 24 * 60 * 60;
      return fetchCandles(symbol, from, now);
    },
    staleTime: 5 * 60 * 1000, // 일봉은 5분간 캐시 유지
  });
}
```

**왜?** 미국/한국 주식의 데이터 소스가 완전히 다르지만(API vs Mock), 컴포넌트 입장에서는 동일한 `CandlestickData[]`를 받음. 시장별 분기를 훅 내부에서 처리하여 차트 컴포넌트는 데이터 소스를 알 필요 없음.

#### 2. 라인차트 — 과거 일봉으로 포트폴리오 손익 역산

```typescript
// App.tsx — buildPortfolioHistoryFromMap()
function buildPortfolioHistoryFromMap(
  stocks: PortfolioStock[],
  candleMap: Record<string, CandlestickData[]>,
): LineChartPoint[] {
  // 1. 모든 종목의 거래일을 합쳐 공통 날짜 목록 생성
  // 2. 각 날짜마다: 종가 × 수량 = 평가금액 합산
  // 3. 평가금액 - 총 매입금액 = 해당일 포트폴리오 손익
  // 4. 해당일 데이터가 하나도 없으면 null 필터링
}
```

**왜?** localStorage에는 "오늘의 보유 종목"만 저장되고 히스토리가 없음. 하지만 과거 일봉 데이터가 있으면 "그날 이 포트폴리오를 보유하고 있었다면 손익이 얼마였을지" 역산 가능. 별도 스냅샷 저장 없이 차트 데이터 생성.

#### 3. 한국 주식 Mock — 시드 기반 결정적 랜덤

```typescript
// services/mockKrx.ts
export function generateKrxMockCandles(symbol: string, days: number): CandlestickData[] {
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) {
    seed = ((seed << 5) - seed + symbol.charCodeAt(i)) | 0;
  }
  function seededRandom(): number {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed & 0x7fffffff) / 2147483647;
  }
  // seed 기반으로 OHLCV 생성 → 같은 종목이면 항상 같은 차트
}
```

**왜?** `Math.random()`을 쓰면 리렌더링마다 차트가 바뀌어 UX가 불안정함. 시드 기반 의사 난수를 사용하면 같은 symbol+days 조합에서 항상 동일한 차트가 나와 사용자가 혼란을 느끼지 않음.

#### 4. 캔들스틱 — 한국식 색상 + 거래량 동기화

```typescript
// components/charts/CandlestickChart.tsx
itemStyle: {
  color: '#ef4444',        // 상승 몸통 — 빨강
  color0: '#3b82f6',       // 하락 몸통 — 파랑
  borderColor: '#ef4444',
  borderColor0: '#3b82f6',
}
// 거래량 바 색상도 상승/하락에 연동
const volumeColorData = data.map((d) => ({
  value: d.volume,
  itemStyle: {
    color: d.close >= d.open ? 'rgba(239, 68, 68, 0.5)' : 'rgba(59, 130, 246, 0.5)',
  },
}));
```

**왜?** 한국 금융권은 상승=빨강, 하락=파랑 컨벤션. 미국식(상승=초록, 하락=빨강)과 반대. 타겟이 한국 금융권 포트폴리오이므로 한국식 적용. 거래량 바 색상도 캔들과 동기화하여 가격-거래량 상관관계를 한눈에 파악 가능.

### 관련 파일

| 파일 | 역할 |
|------|------|
| `src/services/finnhub.ts` | `fetchCandles()` — Finnhub /stock/candle API 호출 |
| `src/services/mockKrx.ts` | `generateKrxMockCandles()` — 한국 주식 Mock 일봉 생성 |
| `src/hooks/useStockCandles.ts` | TanStack Query 캔들 데이터 훅 (시장별 분기 + 캐싱) |
| `src/components/charts/PieChart.tsx` | 종목별 포트폴리오 비중 파이차트 |
| `src/components/charts/LineChart.tsx` | 기간별 손익 추이 라인차트 (이중 Y축) |
| `src/components/charts/CandlestickChart.tsx` | 개별 종목 OHLCV 캔들스틱 + 거래량 차트 |
| `src/types/stock.ts` | `FinnhubCandle`, `CandlestickData`, `PieChartItem`, `LineChartPoint` 타입 |

## 면접 포인트

1. **"히스토리 없이 어떻게 손익 추이를 그렸나요?"** — localStorage에 스냅샷을 매일 저장하는 대신, 과거 일봉 데이터로 역산하는 방식 선택. 사용자가 앱을 매일 열지 않아도 차트가 완성되며, 종목 추가/삭제 시에도 즉시 차트가 갱신됨
2. **"한국 주식은 왜 Mock인데 차트가 안정적인가요?"** — `Math.random()` 대신 시드 기반 결정적 난수(LCG 알고리즘)를 사용하여 동일 입력에 동일 출력 보장. 리렌더링마다 차트가 변하는 문제를 원천 차단
3. **"ECharts를 왜 선택했나요?"** — 캔들스틱 차트를 기본 지원하는 유일한 메이저 라이브러리. Recharts는 캔들스틱 미지원, Chart.js는 플러그인 필요. 학습 난이도가 높지만 금융권 실무에서 실제 사용되는 라이브러리 경험을 확보하기 위해 선택
