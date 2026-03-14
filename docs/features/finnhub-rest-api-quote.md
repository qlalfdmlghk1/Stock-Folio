# Finnhub REST API 실시간 시세 조회

> Finnhub REST API + TanStack Query 폴링으로 미국 주식 현재가를 5초 주기로 자동 갱신하는 기능

## 개요

- **구현 목적**: 실시간 주식 시세 조회는 포트폴리오 트래커의 핵심 기능. WebSocket 구현 전 단계로, REST 폴링 기반의 안정적인 시세 갱신 파이프라인을 먼저 확보
- **사용자 시나리오**: 앱 접속 시 AAPL 현재가/변동률/시가/고가/저가가 카드 형태로 표시되며, 5초마다 자동 갱신

## 구현 내용

### 핵심 동작 흐름

```
App 마운트 → useStockPrice('AAPL') 호출
  → TanStack Query가 fetchQuote() 실행
  → Finnhub /quote API 응답 → StockQuote로 변환
  → 5초 후 자동 refetch (refetchInterval: 5000)
  → 실패 시 exponential backoff로 3회 재시도
```

### 주요 코드

#### 1. API 호출 — AbortController 타임아웃 적용

```typescript
// services/finnhub.ts
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10_000);
const res = await fetch(url, { signal: controller.signal });
```

**왜?** 네트워크 지연 시 무한 대기 방지. 10초 타임아웃으로 UX 보호.

#### 2. TanStack Query 폴링 — WebSocket 전환 대비 설계

```typescript
// hooks/useStockPrice.ts
refetchInterval: POLLING_INTERVAL,  // 5000ms
retry: 3,
retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
```

**왜?** 추후 WebSocket 연결 시 `refetchInterval: false`로만 바꾸면 폴링 중단. 전환 비용 최소화 설계.

#### 3. 잘못된 심볼 방어 처리

```typescript
if (data.c === 0) {
  throw new Error(`"${symbol}" 시세 데이터를 찾을 수 없습니다.`);
}
```

**왜?** Finnhub은 잘못된 심볼에도 200 OK + 모든 값 0으로 응답. HTTP 상태만으로는 감지 불가.

### 관련 파일

| 파일 | 역할 |
|------|------|
| `src/services/finnhub.ts` | Finnhub REST API 호출 + 응답 변환 |
| `src/hooks/useStockPrice.ts` | TanStack Query 훅 (폴링 + 재시도) |
| `src/types/stock.ts` | FinnhubQuote, StockQuote 타입 정의 |
| `src/constants/api.ts` | API URL, 키, 폴링 주기 상수 |
| `src/utils/formatter.ts` | USD/퍼센트/변동값 포맷 함수 |
| `src/App.tsx` | AAPL 현재가 표시 화면 |

## 면접 포인트

1. **Finnhub 선택 근거**: Alpha Vantage(일 25회) vs Finnhub(분 60회) 비교 후, 5초 폴링에 적합한 Finnhub 선택. API 제한을 정량적으로 분석한 의사결정
2. **WebSocket 전환 대비 설계**: `refetchInterval`을 상수로 분리하고, 추후 WebSocket 연결 상태에 따라 `false`로 전환하는 구조를 미리 설계
3. **방어적 에러 처리**: HTTP 200이지만 데이터가 없는 케이스(c=0), 타임아웃, 네트워크 오류를 모두 구분하여 처리
