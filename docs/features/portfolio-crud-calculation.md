# 포트폴리오 CRUD + 수익률 계산

> localStorage 기반 종목 등록/수정/삭제와 순수 함수로 분리된 금융 계산 로직

## 개요

- **구현 목적**: 사용자가 보유 종목(심볼, 매입가, 수량)을 관리하고, 실시간 시세와 결합하여 수익률/평가손익을 자동 계산. 백엔드 없이 localStorage로 데이터 영속성 확보
- **사용자 시나리오**: "종목 등록" 버튼 → 심볼/매입가/수량 입력 → 테이블에 종목 추가 → 실시간 현재가와 매입가를 비교하여 수익률/평가손익 자동 표시 → 새로고침해도 데이터 유지

## 구현 내용

### 핵심 동작 흐름

```
[저장 계층]
portfolioStore.ts (순수 CRUD — localStorage 직접 조작)
        ↓
usePortfolio.ts (React 상태 동기화 — useState + useCallback)
        ↓
App.tsx (UI 이벤트 → usePortfolio의 add/update/remove 호출)

[계산 계층]
calculator.ts (순수 함수 — UI 무관)
        ↓
PortfolioTable.tsx (useMemo로 요약 데이터 계산 — priceMap 변경 시에만 재계산)
```

### 주요 코드

#### 1. 저장소-훅 2계층 분리

```typescript
// store/portfolioStore.ts — 순수 CRUD (React 의존성 없음)
export function addStock(data: StockFormData): PortfolioStock {
  const stocks = loadPortfolio();
  const newStock: PortfolioStock = { id: generateId(), ...data };
  stocks.push(newStock);
  savePortfolio(stocks);
  return newStock;
}

// hooks/usePortfolio.ts — React 상태 동기화
const add = useCallback((data: StockFormData) => {
  addStock(data);       // localStorage에 저장
  refresh();            // React 상태에 반영 → 리렌더링
}, [refresh]);
```

**왜?** store는 React 없이도 동작하는 순수 함수. 향후 저장소를 IndexedDB나 서버 API로 교체할 때 store만 수정하면 됨. 훅은 localStorage 변경을 React 렌더링 사이클에 연결하는 어댑터 역할.

#### 2. 금융 계산 함수 — 순수 함수로 완전 분리

```typescript
// utils/calculator.ts
export function calcReturnRate(currentPrice: number, avgPrice: number): number {
  if (avgPrice === 0) return 0;  // 0원 매입 방어
  return ((currentPrice - avgPrice) / avgPrice) * 100;
}

export function calcPortfolioReturnRate(totalProfitLoss: number, totalCost: number): number {
  if (totalCost === 0) return 0;
  return (totalProfitLoss / totalCost) * 100;
}
```

**왜?** 금융 계산은 비즈니스 핵심 로직. UI 컴포넌트 안에 섞이면 테스트가 어려워짐. 순수 함수로 분리하면 입력→출력만 검증하는 단위 테스트가 가능.

#### 3. 포트폴리오 요약 — useMemo로 불필요한 재계산 방지

```typescript
// components/portfolio/PortfolioTable.tsx
const summary = useMemo(() => {
  let totalCost = 0, totalMarketValue = 0, totalProfitLoss = 0;
  stocks.forEach((stock) => {
    const currentPrice = priceMap[stock.symbol] ?? stock.avgPrice;
    totalCost += calcTotalCost(stock.avgPrice, stock.quantity);
    totalMarketValue += calcMarketValue(currentPrice, stock.quantity);
    totalProfitLoss += calcProfitLoss(currentPrice, stock.avgPrice, stock.quantity);
  });
  return { totalCost, totalMarketValue, totalProfitLoss,
    totalReturnRate: calcPortfolioReturnRate(totalProfitLoss, totalCost) };
}, [stocks, priceMap]);
```

**왜?** 5초 폴링으로 priceMap이 갱신될 때만 재계산. 탭 전환이나 폼 열기 같은 무관한 렌더링에서는 이전 계산 결과를 재사용.

### 관련 파일

| 파일 | 역할 |
|------|------|
| `src/store/portfolioStore.ts` | localStorage CRUD (add/update/remove/load) |
| `src/hooks/usePortfolio.ts` | React 상태 동기화 훅 |
| `src/utils/calculator.ts` | 수익률/손익/평가금액 계산 순수 함수 |
| `src/types/stock.ts` | PortfolioStock, StockFormData 타입 |
| `src/components/portfolio/StockForm.tsx` | 종목 등록/수정 폼 (유효성 검사 포함) |
| `src/components/portfolio/PortfolioTable.tsx` | 종목 테이블 + 요약 카드 |
| `src/components/portfolio/ProfitBadge.tsx` | 수익률 색상 뱃지 (한국식: 수익 빨강, 손실 파랑) |

## 면접 포인트

1. **계층 분리 설계**: store(순수 CRUD) → hook(React 동기화) → component(UI)로 관심사 분리. "저장소를 서버 API로 교체한다면?" 질문에 store 계층만 수정하면 된다고 답변 가능
2. **금융 계산 로직의 테스트 용이성**: 모든 계산 함수가 순수 함수로 분리되어 있어, `calcReturnRate(150, 100)`이 `50`을 반환하는지 바로 단위 테스트 가능. UI와 결합된 계산은 테스트 비용이 높음
3. **0원 매입 방어 처리**: `avgPrice === 0`일 때 0 반환으로 DivisionByZero 방지. 금융 시스템에서 엣지 케이스 처리 의식을 보여줌
