# 데이터 소스 추상화 — priceMap 패턴

> Finnhub API(미국)와 KRX Mock(한국)이라는 완전히 다른 데이터 소스를 `Record<string, number>` 하나로 통일하여, 테이블 컴포넌트가 데이터 출처를 모른 채 동작하는 설계

## 배경

- **문제/필요**: 미국 주식은 Finnhub REST API로 실시간 시세, 한국 주식은 Mock 함수로 시뮬레이션 시세를 가져옴. 데이터 소스가 다르지만 PortfolioTable UI는 동일
- **제약 조건**: 한국 주식은 KRX 데이터 정책상 실시간 API 사용 불가. 향후 KIS API 연동 시에도 UI 변경 없이 데이터 소스만 교체 필요

## 선택지 비교

| 항목 | A. 시장별 별도 테이블 컴포넌트 | B. 테이블 내부에서 데이터 소스 분기 | C. priceMap으로 추상화 (선택) |
|------|------|------|------|
| 코드 중복 | 테이블 로직 2벌 | 없음 | 없음 |
| 테이블의 데이터 소스 의존성 | 없음 (각자 독립) | 높음 (API/Mock 분기 로직 포함) | 없음 (priceMap만 받음) |
| 새 시장 추가 시 | 테이블 1벌 추가 | 분기 조건 추가 | 섹션 컴포넌트만 추가 |
| 테스트 용이성 | 보통 | 어려움 | 쉬움 (priceMap mock 전달) |

## 최종 결정 및 근거

**C. priceMap으로 추상화**를 선택.

결정적 이유는 **PortfolioTable이 데이터 출처를 전혀 모르는 구조**. 테이블은 `priceMap: Record<string, number>`만 props로 받아서 렌더링. Finnhub에서 왔는지, Mock에서 왔는지, 향후 KIS API에서 왔는지 관심 없음.

## 구현 방식

```
[미국 주식]                          [한국 주식]
USPortfolioSection                   KRPortfolioSection
  ↓                                    ↓
useMultipleStockPrices(symbols)      fetchKrxMockQuote(symbol)
  ↓                                    ↓
Finnhub REST API 응답                Mock 함수 반환값
  ↓                                    ↓
priceMap: { AAPL: 195.2, ... }       priceMap: { 005930: 72500, ... }
  ↓                                    ↓
  └──────────── PortfolioTable ────────────┘
               (priceMap만 받음)
```

```typescript
// 미국: Finnhub API → priceMap 변환
const priceMap = useMemo(() => {
  const map: Record<string, number> = {};
  priceQueries.forEach(({ symbol, price }) => {
    if (price !== undefined) map[symbol] = price;
  });
  return map;
}, [priceQueries]);

// 한국: Mock → priceMap 변환
const priceMap = useMemo(() => {
  const map: Record<string, number> = {};
  stocks.forEach((stock) => {
    const quote = fetchKrxMockQuote(stock.symbol);
    if (quote) map[stock.symbol] = quote.currentPrice;
  });
  return map;
}, [stocks]);

// PortfolioTable — 데이터 출처에 무관하게 동일 인터페이스
interface PortfolioTableProps {
  stocks: PortfolioStock[];
  market: Market;
  priceMap: Record<string, number>;  // ← 이것만 알면 됨
  onEdit: (stock: PortfolioStock) => void;
  onDelete: (id: string) => void;
}
```

### 새 시장(예: 일본 주식) 추가 시

```typescript
// JPPortfolioSection만 추가하면 됨
function JPPortfolioSection({ stocks, onEdit, onDelete }) {
  const priceMap = useMemo(() => {
    // 일본 시세 API 호출 → Record<string, number> 변환
  }, [stocks]);
  return <PortfolioTable stocks={stocks} market="JP" priceMap={priceMap} ... />;
}
```

PortfolioTable, StockForm, ProfitBadge는 변경 없음.

## 트레이드오프

- **얻은 것**: 테이블 컴포넌트의 재사용성 극대화. 데이터 소스 교체/추가 시 UI 변경 제로. 테스트 시 `priceMap: { AAPL: 100 }`만 넘기면 됨
- **감수한 것**: 섹션 컴포넌트(USPortfolioSection, KRPortfolioSection)를 시장별로 만들어야 함. priceMap 변환 로직이 각 섹션에 분산
- **대응 방법**: 섹션 컴포넌트의 역할은 "데이터 소스 → priceMap 변환"으로 명확. 시장 추가 시에도 이 패턴을 따르면 일관성 유지

## 면접 포인트

1. **인터페이스 설계 능력**: 복잡한 데이터 흐름을 `Record<string, number>` 하나로 단순화. "API가 바뀌어도 UI는 안 바뀐다"는 것을 코드로 증명
2. **확장성 설계**: "일본 주식을 추가한다면?" → "섹션 컴포넌트만 추가하면 됩니다. 테이블은 변경 없습니다"라고 즉답 가능
3. **실무 패턴 적용**: 이 패턴은 금융 시스템에서 여러 거래소/데이터 벤더를 통합할 때 실제로 사용하는 어댑터 패턴의 프론트엔드 버전. 실무 감각을 보여줌
