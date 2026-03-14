# 한국 주식 Mock 시뮬레이션

> KRX 데이터 정책 제약을 분석하고, 장중 시간 기반 Realistic Mock으로 한국 주식 시세를 시뮬레이션하는 기능

## 개요

- **구현 목적**: 한국 주식 시세를 포트폴리오에 포함하되, KRX의 폐쇄적 데이터 정책으로 실시간 API 사용이 불가능한 환경에서 현실적인 대안 마련
- **사용자 시나리오**: 한국 주식 탭에서 삼성전자, SK하이닉스 등 10개 종목을 등록하면, 장중(09:00~15:30 KST)에는 기준가 ±3% 범위에서 시뮬레이션된 시세가 표시되고, 장외 시간에는 기준가가 그대로 표시됨

## 구현 내용

### 핵심 동작 흐름

```
사용자가 한국 종목 등록 (select에서 선택)
  → KRPortfolioSection이 fetchKrxMockQuote(symbol) 호출
  → isKrxMarketOpen()으로 장중/장외 판단
    → 장중: 기준가 ±3% 범위에서 랜덤 변동가 생성
    → 장외: 기준가 그대로 반환
  → PortfolioTable에 priceMap으로 전달
```

### 주요 코드

#### 1. 장중/장외 판단 — KST 타임존 기반

```typescript
// services/mockKrx.ts
export function isKrxMarketOpen(): boolean {
  const now = new Date();
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const totalMinutes = kst.getHours() * 60 + kst.getMinutes();
  // 09:00 (540분) ~ 15:30 (930분)
  return totalMinutes >= 540 && totalMinutes < 930;
}
```

**왜?** 사용자의 로컬 타임존과 무관하게 KST 기준으로 판단해야 함. Vercel 배포 시 전 세계 어디서 접속해도 한국 장 시간을 정확히 감지.

#### 2. 현실적 가격 시뮬레이션 — ±3% 범위 + 호가 단위

```typescript
function simulatePrice(basePrice: number): number {
  if (!isKrxMarketOpen()) return basePrice;
  const fluctuation = (Math.random() - 0.5) * 0.06; // ±3%
  const simulated = basePrice * (1 + fluctuation);
  return Math.round(simulated); // 1원 단위 반올림
}
```

**왜?** KOSPI 일일 변동폭이 평균 ±1~2%이므로 ±3%는 현실적 범위. `Math.round`로 한국 주식 호가 단위(정수)를 반영.

#### 3. OHLCV 구조 유지 — 캔들스틱 차트 호환

```typescript
export function fetchKrxMockQuote(symbol: string): KrxMockQuote | null {
  const currentPrice = simulatePrice(stock.basePrice);
  const open = simulatePrice(stock.basePrice);
  const high = Math.max(currentPrice, open, simulatePrice(stock.basePrice));
  const low = Math.min(currentPrice, open, simulatePrice(stock.basePrice));
  return { symbol, name, currentPrice, change, changePercent, high, low, open, previousClose, volume };
}
```

**왜?** 3주차 ECharts 캔들스틱 차트에서 OHLCV 데이터가 필요. Mock이지만 실제 API 응답과 동일한 구조를 유지하여 차트 연동 시 코드 변경 없이 사용 가능.

### 관련 파일

| 파일 | 역할 |
|------|------|
| `src/services/mockKrx.ts` | Mock 시세 생성 + 장중 판단 + 종목 목록 |
| `src/types/stock.ts` | KrxMockQuote 타입 정의 |
| `src/App.tsx` (KRPortfolioSection) | Mock 시세를 priceMap으로 변환하여 테이블에 전달 |

## 면접 포인트

1. **금융 데이터 규제 이해**: KRX의 폐쇄적 데이터 정책, KIS API의 개인 인증 요구, 비공식 크롤링의 법적 리스크를 분석하고 Mock이라는 현실적 대안을 선택한 의사결정 과정 자체가 도메인 이해도를 보여줌
2. **실제 API 교체를 고려한 설계**: Mock 함수가 실제 API와 동일한 응답 구조(OHLCV)를 반환하도록 설계. 향후 KIS API 연동 시 `fetchKrxMockQuote`만 교체하면 나머지 코드는 변경 없음
3. **장중/장외 분기 처리**: 타임존을 고려한 시간 판단 로직으로, 글로벌 배포 환경에서도 정확한 장 상태 감지
