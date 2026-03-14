# localStorage 2계층 아키텍처

> 저장소 계층(store)과 React 동기화 계층(hook)을 분리하여, 저장소 교체 시 변경 범위를 store 한 곳으로 격리한 설계

## 배경

- **문제/필요**: localStorage에 포트폴리오 데이터(종목, 매입가, 수량)를 저장하되, 컴포넌트에서 localStorage를 직접 조작하면 React 렌더링 사이클과 동기화되지 않음
- **제약 조건**: 백엔드 없이 프론트엔드 단독으로 데이터 영속성 확보. 향후 서버 API나 IndexedDB로 교체 가능성 존재

## 선택지 비교

| 항목 | A. 컴포넌트에서 직접 localStorage 조작 | B. 단일 Custom Hook | C. Store + Hook 2계층 (선택) |
|------|------|------|------|
| React 상태 동기화 | 수동 (매번 useState 갱신 코드 필요) | 자동 | 자동 |
| 저장소 교체 용이성 | 모든 컴포넌트 수정 필요 | Hook 내부 전체 수정 | Store만 수정 |
| 테스트 용이성 | 어려움 (React 컨텍스트 필요) | 보통 | Store는 순수 함수로 단위 테스트 가능 |
| 코드 분량 | 적음 | 보통 | 약간 많음 (파일 2개) |

## 최종 결정 및 근거

**C. Store + Hook 2계층**을 선택.

결정적 이유는 **저장소 교체 시 변경 범위 격리**. 금융 SI 프로젝트에서는 초기에 localStorage로 프로토타이핑 후 서버 API로 전환하는 경우가 흔함. Store 계층이 React에 의존하지 않는 순수 함수로 구성되면:

1. `addStock()`, `loadPortfolio()` 등을 서버 API 호출로 교체해도 Hook/Component는 변경 없음
2. Store 함수만으로 단위 테스트 가능 (React 렌더링 불필요)

## 구현 방식

```
portfolioStore.ts (Store 계층)     usePortfolio.ts (Hook 계층)
─────────────────────────         ─────────────────────────
addStock(data)                    add(data) {
  → localStorage.setItem()          addStock(data)    // Store 호출
  → return newStock                  refresh()         // React 상태 갱신
                                  }
loadPortfolio()
  → localStorage.getItem()       useState(() => loadPortfolio())
  → JSON.parse()                    // 초기값도 Store에서 가져옴
```

```typescript
// store/portfolioStore.ts — React 의존성 제로
export function addStock(data: StockFormData): PortfolioStock {
  const stocks = loadPortfolio();
  const newStock = { id: generateId(), ...data };
  stocks.push(newStock);
  savePortfolio(stocks);
  return newStock;
}

// hooks/usePortfolio.ts — Store를 React에 연결하는 어댑터
export function usePortfolio(market?: Market) {
  const [stocks, setStocks] = useState(() =>
    market ? getStocksByMarket(market) : loadPortfolio(),
  );
  const refresh = useCallback(() => {
    setStocks(market ? getStocksByMarket(market) : loadPortfolio());
  }, [market]);
  const add = useCallback((data: StockFormData) => {
    addStock(data);
    refresh();
  }, [refresh]);
  // ...
}
```

## 트레이드오프

- **얻은 것**: 저장소 교체 시 Store 1개 파일만 수정. Store 함수의 독립적 단위 테스트 가능
- **감수한 것**: 파일이 2개로 분리되어 코드 분량 약간 증가. 단순한 CRUD에 비해 구조가 복잡해 보일 수 있음
- **대응 방법**: Store와 Hook의 역할을 JSDoc 주석으로 명확히 구분. Store는 "어디에 저장하는가", Hook은 "React와 어떻게 동기화하는가"

## 면접 포인트

1. **관심사 분리 실천**: "localStorage 대신 서버 API로 바꾼다면?" 질문에 "store 파일 하나만 수정하면 됩니다"라고 즉답 가능. 계층 분리가 이론이 아닌 실제 코드로 구현되어 있음
2. **순수 함수 테스트 전략**: Store의 `addStock()`, `loadPortfolio()`는 React 없이도 동작하는 순수 함수. `addStock({...})` 호출 후 `loadPortfolio()`로 결과를 검증하는 단위 테스트가 바로 가능
3. **금융 SI 환경 고려**: 프로토타입 → 실서비스 전환 시 저장소 교체는 필연적. 이를 초기 설계 단계에서 고려한 것은 실무 감각을 보여줌
