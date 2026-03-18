# WebSocket 실시간 시세 갱신 + 폴링 백업

> Finnhub WebSocket으로 체결가를 실시간 수신하고, 단절 시 REST 폴링으로 자동 전환하는 이중화 구조

## 개요

- **구현 목적**: 미국 주식 시세를 실시간으로 갱신하되, 네트워크 환경에 관계없이 데이터 연속성을 보장
- **사용자 시나리오**: 사용자가 미국 주식 탭에서 보유 종목을 확인하면, 장중에는 체결가가 실시간으로 반영되고, 장외 시간에는 "장 마감" 배너와 함께 마지막 종가가 표시됨

## 구현 내용

### 핵심 동작 흐름

```
앱 실행 → Finnhub WebSocket 연결 (wss://ws.finnhub.io)
       → 보유 종목 전체 구독 (최대 50개)
       → 체결 데이터 수신 시 TanStack Query 캐시 직접 업데이트
       → UI 자동 반영 (별도 setState 불필요)

WebSocket 단절 감지
       → Exponential Backoff로 재연결 시도 (1s → 2s → 4s → ... → 최대 30s)
       → 동시에 REST 폴링(5초 주기) 자동 활성화
       → 재연결 성공 시 폴링 비활성화 + 종목 재구독
```

### 주요 코드

**1. WebSocket 체결가 → TanStack Query 캐시 직접 업데이트**

WebSocket에서 수신한 체결가를 `queryClient.setQueryData`로 기존 Query 캐시에 주입한다. 이렇게 하면 `useStockPrice` 훅을 사용하는 모든 컴포넌트가 별도 로직 없이 최신 가격을 자동으로 반영한다.

```typescript
// useWebSocket.ts — onmessage 핸들러
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'trade' && message.data?.length > 0) {
    // 같은 심볼의 여러 체결 중 마지막 체결가만 사용
    const latestBySymbol = new Map();
    for (const trade of message.data) {
      latestBySymbol.set(trade.s, trade);
    }

    // TanStack Query 캐시에 체결가 반영
    latestBySymbol.forEach((trade, symbol) => {
      queryClient.setQueryData(['quote', symbol], (prev) => ({
        ...prev,
        currentPrice: trade.p,
        timestamp: Math.floor(trade.t / 1000),
      }));
    });
  }
};
```

**왜 이렇게 했는지**: WebSocket 데이터를 별도 상태로 관리하면 REST 폴링 데이터와 이중 관리가 필요하다. TanStack Query 캐시를 단일 진실 공급원(Single Source of Truth)으로 활용하면 WebSocket/REST 어느 쪽에서 데이터가 오든 동일한 경로로 UI에 반영된다.

**2. WebSocket 연결 상태에 따른 폴링 자동 전환**

```typescript
// useStockPrice.ts
export function useStockPrice(symbol: string, isWebSocketConnected = false) {
  return useQuery({
    queryKey: ['quote', symbol],
    queryFn: () => fetchQuote(symbol),
    // WebSocket 정상 → 폴링 OFF (API 한도 절약)
    // WebSocket 단절 → 5초 폴링 자동 전환 (UX 연속성)
    refetchInterval: isWebSocketConnected ? false : POLLING_INTERVAL,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  });
}
```

**왜 이렇게 했는지**: TanStack Query의 `refetchInterval`을 동적으로 제어하여, WebSocket 연결 상태 하나로 폴링 ON/OFF를 전환한다. WebSocket이 정상이면 REST API 호출이 0이 되어 분당 60회 한도를 아낄 수 있다.

**3. Exponential Backoff 재연결**

```typescript
// useWebSocket.ts
function getReconnectDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 30_000);
  // 1회: 1초, 2회: 2초, 3회: 4초, ... 최대 30초
}
```

**왜 이렇게 했는지**: 서버 장애 시 모든 클라이언트가 동시에 재연결하면 서버 부하가 가중된다. 지수적으로 대기 시간을 늘려 서버 복구 시간을 확보하면서도, 초기 1~2초 내에 일시적 단절은 빠르게 복구한다.

**4. 동적 구독 동기화**

```typescript
// useWebSocket.ts — symbols 변경 감지
useEffect(() => {
  if (status !== 'connected') return;

  const newSymbols = new Set(symbols.filter(Boolean));

  // 새로 추가된 종목 구독
  newSymbols.forEach((s) => {
    if (!currentSubscribed.has(s)) subscribe(s);
  });

  // 제거된 종목 구독 해제
  currentSubscribed.forEach((s) => {
    if (!newSymbols.has(s)) unsubscribe(s);
  });
}, [symbols.join(','), status]);
```

**왜 이렇게 했는지**: 사용자가 종목을 추가/삭제할 때 WebSocket 구독도 자동으로 동기화되어야 한다. 구독 목록을 `ref`로 관리하여 현재 구독 상태와 새 종목 목록을 비교하고, 차이만 구독/해제한다.

**5. 장중/장외 감지 및 UI 반영**

```typescript
// useMarketStatus.ts
function getUsMarketStatus(): MarketStatus {
  // ET(미국 동부시간) 기준으로 정규장 시간 판단
  // NYSE/NASDAQ: 월~금 09:30~16:00 ET (서머타임 자동 반영)
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  // ...
}
```

**왜 이렇게 했는지**: `toLocaleString`의 `timeZone` 옵션으로 서머타임을 자동 처리한다. 별도 타임존 라이브러리 없이 브라우저 Intl API만으로 정확한 장 시간 판단이 가능하다.

### 관련 파일

| 파일 | 역할 |
|------|------|
| `src/hooks/useWebSocket.ts` | Finnhub WebSocket 연결/구독/재연결 관리 |
| `src/hooks/useMarketStatus.ts` | 미국/한국 장중·장외 실시간 감지 |
| `src/hooks/useStockPrice.ts` | TanStack Query 기반 시세 조회 (폴링 자동 전환) |
| `src/hooks/useMultipleStockPrices.ts` | 다중 종목 시세 조회 (WebSocket 상태 전달) |
| `src/components/ui/MarketStatusBanner.tsx` | 장 마감 / WebSocket 단절 배너 |
| `src/components/ui/MarketStatusIndicator.tsx` | 헤더 장 상태 인디케이터 |
| `src/components/portfolio/USPortfolioSection.tsx` | WebSocket + 시세 + 차트 통합 |
| `src/constants/api.ts` | WebSocket URL, 폴링 주기 등 상수 |

## API 한도 소비 비교

| 상황 | API 호출/분 |
|------|-------------|
| WebSocket 정상 (이전: REST 폴링만) | **0회** (이전: 종목 수 × 12회) |
| WebSocket 단절 → 폴링 전환 | 종목 수 × 12회 (5초 주기) |

10종목 기준, WebSocket 정상 시 분당 120회 → 0회로 절약.

## 면접 포인트

1. **WebSocket + REST 폴링 이중화 설계**: WebSocket만 단독 사용하면 방화벽/프록시 환경에서 동작 불가 위험이 있다. 단절 감지 시 자동으로 REST 폴링으로 전환하여 어떤 네트워크 환경에서도 시세 갱신이 끊기지 않도록 설계했다. 이 설계의 핵심은 **TanStack Query 캐시를 Single Source of Truth로 활용**하여 데이터 소스(WebSocket/REST)가 바뀌어도 UI 코드는 변경 없이 동작한다는 점이다.

2. **Exponential Backoff 재연결 전략**: 단순 즉시 재연결은 서버 장애 시 모든 클라이언트가 동시에 재연결을 시도하여 부하를 가중시킨다. 1초 → 2초 → 4초 → ... → 최대 30초로 대기 시간을 지수적으로 늘려 서버 복구 시간을 확보하면서, 일시적 단절에는 1~2초 내 빠르게 복구된다.

3. **동적 구독 동기화 + 구독 복구**: 종목 추가/삭제 시 WebSocket 구독 목록이 자동으로 동기화되고, 재연결 시 기존 구독 목록을 모두 복구한다. 구독 상태를 `ref`로 관리하여 불필요한 리렌더링 없이 구독 변경을 처리한다.
