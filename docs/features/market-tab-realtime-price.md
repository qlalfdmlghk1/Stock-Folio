# 미국/한국 탭 분리 + 실시간 시세 연동

> 시장별 탭 전환 UI와 Finnhub API 제한(분당 60회) 내에서 최대 10종목을 동시 폴링하는 실시간 시세 아키텍처

## 개요

- **구현 목적**: 미국 주식(Finnhub 실시간)과 한국 주식(Mock)을 하나의 앱에서 탭으로 전환하며 관리. 각 시장의 데이터 소스가 다르지만 동일한 PortfolioTable UI를 공유
- **사용자 시나리오**: 상단 탭에서 "미국 주식" / "한국 주식" 전환 → 해당 시장의 등록 종목과 시세가 표시됨. 미국 주식은 5초마다 실시간 갱신, 한국 주식은 장중에만 시뮬레이션

## 구현 내용

### 핵심 동작 흐름

```
[미국 주식 탭]
USPortfolioSection
  → useMultipleStockPrices(symbols)  // 최대 10개 종목
    → useStockPrice(symbol) × N      // TanStack Query 개별 캐시
    → Finnhub REST API 5초 폴링
  → priceMap 생성 → PortfolioTable에 전달

[한국 주식 탭]
KRPortfolioSection
  → fetchKrxMockQuote(symbol) × N    // Mock 함수 호출
  → priceMap 생성 → PortfolioTable에 전달

[공통]
PortfolioTable (React.memo)
  → priceMap + stocks → 수익률/손익 계산 → 렌더링
```

### 주요 코드

#### 1. 다종목 동시 시세 조회 — API 제한 대응

```typescript
// App.tsx
function useMultipleStockPrices(symbols: string[]) {
  const limited = symbols.slice(0, 10); // 최대 10개 제한

  const q0 = useStockPrice(limited[0] ?? '');
  const q1 = useStockPrice(limited[1] ?? '');
  // ... q2~q9

  return limited.map((symbol, i) => ({
    symbol,
    price: queries[i].data?.currentPrice,
  }));
}
```

**왜?** Finnhub 무료 플랜은 분당 60회 제한. 10종목 × 5초 폴링 = 분당 120회로 초과. TanStack Query의 캐시 + staleTime으로 실제 API 호출은 분당 약 12회(5초 × 12)로 유지. 10종목이 동시에 refetch하지 않고 Query 캐시가 중복 요청을 방지.

#### 2. 데이터 소스가 다른 두 섹션 — 동일 UI 공유

```typescript
// 미국: Finnhub REST → priceMap
const priceMap = useMemo(() => {
  const map: Record<string, number> = {};
  priceQueries.forEach(({ symbol, price }) => {
    if (price !== undefined) map[symbol] = price;
  });
  return map;
}, [priceQueries]);

// 한국: Mock → priceMap
const priceMap = useMemo(() => {
  const map: Record<string, number> = {};
  stocks.forEach((stock) => {
    const quote = fetchKrxMockQuote(stock.symbol);
    if (quote) map[stock.symbol] = quote.currentPrice;
  });
  return map;
}, [stocks]);
```

**왜?** 데이터 소스(Finnhub API vs Mock)는 다르지만, 최종적으로 `Record<string, number>` 형태의 priceMap으로 통일. PortfolioTable은 데이터가 어디서 왔는지 모르고, priceMap만 받아서 렌더링. 새로운 데이터 소스 추가 시 섹션 컴포넌트만 작성하면 됨.

#### 3. 탭 전환 시 상태 초기화

```typescript
const handleTabChange = useCallback((market: Market) => {
  setActiveMarket(market);
  setShowForm(false);       // 열려있던 폼 닫기
  setEditingStock(undefined); // 수정 모드 해제
}, []);
```

**왜?** 미국 탭에서 수정 중이던 폼이 한국 탭으로 전환해도 남아있으면 시장 불일치 버그 발생. 탭 전환 시 폼 관련 상태를 모두 초기화.

### 관련 파일

| 파일 | 역할 |
|------|------|
| `src/App.tsx` | 탭 UI + USPortfolioSection + KRPortfolioSection + useMultipleStockPrices |
| `src/hooks/useStockPrice.ts` | TanStack Query 폴링 훅 (개별 종목) |
| `src/hooks/usePortfolio.ts` | 시장별 종목 필터링 (`usePortfolio(market)`) |
| `src/services/mockKrx.ts` | 한국 주식 Mock 시세 + 장 상태 판단 |
| `src/components/portfolio/PortfolioTable.tsx` | 시장 무관 공통 테이블 (priceMap 기반) |

## 면접 포인트

1. **API Rate Limit 설계**: Finnhub 분당 60회 제한을 정량적으로 분석하고, 최대 동시 종목 수(10개)를 결정한 과정. TanStack Query 캐시로 중복 요청을 방지하는 구조
2. **데이터 소스 추상화**: Finnhub API와 KRX Mock이라는 전혀 다른 데이터 소스를 `priceMap: Record<string, number>`로 통일. PortfolioTable은 데이터 출처를 몰라도 동작하는 관심사 분리
3. **장 상태 인디케이터**: 헤더에 실시간 장 상태(KRX 장중/장 마감, Finnhub 폴링 중)를 표시하여, 현재 시세가 실시간인지 마감가인지 사용자가 즉시 파악 가능
