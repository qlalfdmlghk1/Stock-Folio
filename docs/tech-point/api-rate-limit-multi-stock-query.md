# 다종목 동시 시세 조회 + API Rate Limit 대응

> Finnhub 분당 60회 API 제한 내에서 최대 10종목의 실시간 시세를 5초 주기로 폴링하는 설계

## 배경

- **문제/필요**: 포트폴리오에 여러 종목이 등록되면 각 종목의 현재가를 동시에 조회해야 함. 단순히 N개 종목 × 5초 폴링을 하면 API 한도 초과
- **제약 조건**: Finnhub 무료 플랜 — 분당 60회 REST API 호출 제한. WebSocket은 4주차 구현 예정이므로 현재는 REST 폴링만 사용

## 정량 분석

```
[시나리오] 10종목 등록, 5초 폴링

단순 계산:
  10종목 × 12회/분 (5초 주기) = 120회/분 → 분당 60회 한도 초과 ❌

TanStack Query 캐시 적용 후:
  각 종목이 독립적 queryKey로 관리됨
  staleTime 내 동일 쿼리 → 캐시 반환 (API 호출 안 함)
  실제 분당 호출 = 약 12회 (5초 × 12, 종목들이 동시 refetch하지 않음)
  → 분당 60회 한도 내 충분히 여유 ✅
```

## 선택지 비교

| 항목 | A. 종목마다 개별 setInterval | B. 하나의 배치 API 호출 | C. TanStack Query 개별 캐시 (선택) |
|------|------|------|------|
| 캐시 관리 | 수동 구현 필요 | 수동 구현 필요 | 자동 (queryKey 기반) |
| 중복 요청 방지 | 직접 구현 | 불가 (배치) | 자동 (stale 체크) |
| 에러 격리 | 종목별 처리 필요 | 한 종목 실패 시 전체 실패 | 종목별 독립적 에러/재시도 |
| 코드 복잡도 | 높음 | 보통 | 낮음 (Hook 재사용) |

## 최종 결정 및 근거

**C. TanStack Query 개별 캐시**를 선택.

결정적 이유:
1. **에러 격리**: AAPL 조회 실패해도 MSFT는 정상 폴링 유지. 배치 방식은 한 종목 실패 시 전체가 중단됨
2. **캐시 자동 관리**: `queryKey: ['quote', symbol]`로 종목별 독립 캐시. 동일 심볼의 중복 요청을 TanStack Query가 자동 방지
3. **기존 useStockPrice 재사용**: 1주차에 만든 단일 종목 훅을 변경 없이 N번 호출하는 구조

## 구현 방식

```typescript
// App.tsx — 최대 10개 제한으로 API 폭주 방지
function useMultipleStockPrices(symbols: string[]) {
  const limited = symbols.slice(0, 10);

  const q0 = useStockPrice(limited[0] ?? '');
  const q1 = useStockPrice(limited[1] ?? '');
  // ... q2~q9 (React Hook 규칙상 조건부 호출 불가 → 고정 10개)

  return limited.map((symbol, i) => ({
    symbol,
    price: queries[i].data?.currentPrice,
  }));
}
```

```typescript
// hooks/useStockPrice.ts — 기존 단일 종목 훅 (변경 없이 재사용)
export function useStockPrice(symbol: string) {
  return useQuery({
    queryKey: ['quote', symbol],
    queryFn: () => fetchQuote(symbol),
    refetchInterval: 5000,
    enabled: !!symbol,  // 빈 문자열이면 호출하지 않음
  });
}
```

### 왜 고정 10개 Hook 호출인가?

React Hook 규칙(Rules of Hooks)에 의해 Hook을 조건부나 반복문 안에서 호출할 수 없음. `symbols.map(s => useStockPrice(s))`는 불가. 따라서 q0~q9으로 고정 선언하고, `enabled: !!symbol`로 빈 심볼은 API를 호출하지 않도록 처리.

## 트레이드오프

- **얻은 것**: 에러 격리, 캐시 자동 관리, 기존 Hook 재사용. API 한도 내 안정적 운영
- **감수한 것**: 최대 10종목 제한. q0~q9 고정 선언이 다소 반복적인 코드
- **대응 방법**: 4주차 WebSocket 구현 시 50종목까지 무제한 수신 가능. WebSocket 전환 후에는 `refetchInterval: false`로 폴링 비활성화하여 API 호출 0

## 면접 포인트

1. **API 제한을 정량적으로 분석**: "분당 60회 한도에서 10종목 × 5초 = 120회인데 어떻게 해결했나요?" → TanStack Query 캐시 메커니즘과 staleTime으로 실제 호출 수가 제어됨을 수치로 설명
2. **에러 격리 설계**: 종목별 독립 쿼리로 한 종목 실패가 전체에 영향을 주지 않는 구조. 금융 시스템에서 부분 장애 격리는 핵심 요구사항
3. **WebSocket 전환 대비**: 현재 REST 폴링은 임시 방안이며, `refetchInterval`을 `false`로만 바꾸면 WebSocket으로 전환 가능한 구조를 미리 설계
