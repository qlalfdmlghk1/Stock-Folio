# StockFolio — 기술 문서

> Finnhub WebSocket 기반 실시간 주식 포트폴리오 트래커 — 금융 도메인 특수성을 반영한 프론트엔드 설계

---

## 1. 프로젝트 개요

### 1.1 프로젝트 소개

StockFolio는 사용자가 보유 종목을 등록하고 실시간 시세 기반으로 수익률을 추적하는 포트폴리오 트래커입니다.

- **목적**: 금융권 IT 직군(NH투자증권, IBK기업은행 등) 포트폴리오 제출용 프로젝트
- **구조**: 프론트엔드 전용 (백엔드 없음, Vercel 배포)
- **데이터 저장**: localStorage 기반 영속성 (보유 종목, 매입가, 수량)
- **핵심 차별점**: WebSocket 실시간 통신, REST 폴링 자동 전환, Gemini AI 종목 요약, 금융 도메인 예외 처리

### 1.2 기술 스택 및 선정 이유

| 기술                      | 선택 이유                                                                                                             | 대안 검토                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **React 18 + TypeScript** | 컴포넌트 기반 UI + 타입 안전성. 금융 데이터의 정확한 타입 관리 필수                                                   | —                                     |
| **TanStack Query v5**     | 서버 상태 캐싱, 자동 폴링, 에러 재시도를 선언적으로 처리. WebSocket ↔ REST 전환 시 `refetchInterval` 하나로 제어 가능 | SWR (WebSocket 연동 패턴이 덜 직관적) |
| **ECharts**               | 캔들스틱 차트 기본 지원 + 금융권 실무 사용률 높음. Recharts는 캔들스틱 미지원, Chart.js는 플러그인 필요               | Recharts, Chart.js                    |
| **Finnhub API**           | 분당 60회 호출 + WebSocket 무료 제공. Alpha Vantage는 일 25회로 5초 폴링 불가                                         | Alpha Vantage                         |
| **Gemini API**            | 카드 등록 불필요 + 무료 하루 1,000회. 종목 요약 용도에 충분한 성능                                                    | OpenAI GPT-4o mini, Claude Haiku      |
| **Tailwind CSS**          | 유틸리티 기반으로 금융 UI의 조건부 색상 처리(수익/손실)에 적합                                                        | styled-components                     |
| **Vite**                  | HMR 속도 + TypeScript 네이티브 지원                                                                                   | CRA                                   |

### 1.3 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                        App.tsx (탭 라우팅)                    │
│  ┌──────────────────────┐  ┌──────────────────────────┐     │
│  │  USPortfolioSection  │  │  KRPortfolioSection      │     │
│  │  ┌────────────────┐  │  │  ┌──────────────────┐   │     │
│  │  │ useWebSocket   │  │  │  │ fetchKrxMockQuote│   │     │
│  │  │ useMultiple    │  │  │  └──────┬───────────┘   │     │
│  │  │ StockPrices    │  │  │         │               │     │
│  │  └──────┬─────────┘  │  │         │               │     │
│  │         │             │  │         │               │     │
│  │    priceMap           │  │    priceMap             │     │
│  │         │             │  │         │               │     │
│  └─────────┼─────────────┘  └─────────┼───────────────┘     │
│            └──────────┬───────────────┘                      │
│                       ▼                                      │
│            PortfolioTable (공유)                              │
│            ┌──────────────────────────────────────┐          │
│            │ StockForm │ ProfitBadge │ ECharts 3종 │          │
│            └──────────────────────────────────────┘          │
│                       ▼                                      │
│            StockSummary (AI 종목 요약)                        │
│            ┌──────────────────────────────────────┐          │
│            │ Gemini 2.5 Flash Lite → 2~3줄 한국어  │          │
│            └──────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘

데이터 흐름:
  Finnhub WebSocket ──→ TanStack Query 캐시 ──→ priceMap ──→ UI
  Finnhub REST API  ──→ TanStack Query 캐시 ──┘ (폴링 백업)
  KRX Mock 함수     ──→ priceMap ──────────────┘
  Gemini API        ──→ TanStack Query 캐시 ──→ StockSummary
```

**핵심 설계 원칙**: 데이터 소스(Finnhub/Mock)가 무엇이든 `priceMap: Record<string, number>` 하나로 추상화하여 UI 컴포넌트가 데이터 출처에 의존하지 않는 구조입니다.

---

## 2. 핵심 기술 의사결정

### 2.1 Finnhub vs Alpha Vantage — API 제한 정량 분석

**배경**: 미국 주식 실시간 시세를 무료 API로 제공해야 하는 상황에서, 5초 폴링 주기를 유지할 수 있는 API를 선택해야 했습니다.

| 항목            | Alpha Vantage (무료) | Finnhub (무료)     |
| --------------- | -------------------- | ------------------ |
| 호출 제한       | **일 25회**          | **분당 60회**      |
| WebSocket       | 없음                 | 있음 (무료)        |
| 캔들스틱 데이터 | 지원                 | 유료 전환됨 (후술) |

**정량 분석**: 5초 폴링 × 10종목 = 분당 120회 호출. Alpha Vantage는 일 25회로 **2분 만에 한도 초과**. Finnhub은 분당 60회이며 TanStack Query의 `staleTime` 캐싱으로 실제 호출을 약 12회/분으로 제어 가능했습니다.

**트레이드오프**: Finnhub의 캔들스틱(과거 시세) API가 유료로 전환되면서 Alpha Vantage를 보조 API로 병행하게 되었습니다(2.7절 참고). 실시간 시세는 Finnhub, 과거 데이터는 Alpha Vantage로 **용도별 API 분리** 전략을 채택했습니다.

### 2.2 미국 주식 실시간 vs 한국 주식 Mock — 금융 데이터 규제 대응

**배경**: 한국 주식도 실시간으로 보여주고 싶었으나, KRX(한국거래소)의 데이터 정책이 폐쇄적이라는 제약이 있었습니다.

**한국 주식 실시간 API가 불가능한 이유:**

- KRX는 지정 업체 외 시장 데이터 재판매를 불허
- KIS Open API: 실제 증권 계좌 + 개인 인증 필요 → 공개 데모에 사용 불가
- 네이버/다음 비공식 크롤링: 이용약관 위반 가능성

**결정**: 한국 주식은 **장중 시간 기반 Realistic Mock 시뮬레이션**으로 구현하되, 향후 KIS API 연동을 고려한 구조로 설계했습니다. Mock 함수가 실제 API와 동일한 `OHLCV` 구조를 반환하므로, 향후 KIS API 연동 시 **함수 교체만으로 전환 가능**합니다.

### 2.3 ECharts 선택 — 학습 난이도를 감수한 이유

**배경**: 포트폴리오 시각화에 캔들스틱 차트가 필수였습니다.

| 항목               | Recharts | Chart.js      | ECharts (선택) |
| ------------------ | -------- | ------------- | -------------- |
| 캔들스틱 차트      | 미지원   | 플러그인 필요 | **기본 지원**  |
| 금융권 실무 사용   | 낮음     | 보통          | **높음**       |
| 대용량 렌더링 성능 | 보통     | 보통          | **우수**       |
| 학습 난이도        | 쉬움     | 보통          | **높음**       |

**결정 근거**: Recharts가 가장 쉽지만 캔들스틱 미지원으로 제외. ECharts는 학습 비용이 높지만, 금융권에서 실제로 사용하는 라이브러리 경험을 확보하는 것이 포트폴리오 목적에 부합했습니다. **쉬운 선택지를 놔두고 어려운 것을 선택한 근거**가 있다는 것 자체가 면접 어필 포인트입니다.

### 2.4 WebSocket + REST 폴링 백업 — 이중 통신 구조

**배경**: Finnhub WebSocket으로 실시간 체결가를 받되, WebSocket이 실패하는 환경(방화벽, 프록시)에서도 서비스가 중단되지 않아야 했습니다.

**WebSocket 무료 플랜 제한:**

| 항목               | 제한                               |
| ------------------ | ---------------------------------- |
| 동시 구독 종목     | 최대 50개                          |
| 데이터 수신        | 무제한                             |
| API 호출 횟수 소비 | **없음** (분당 60회 한도에 미포함) |

**설계:**

```
WebSocket 연결 성공
  → 실시간 체결가 수신 (API 호출 0회/분)
  → refetchInterval: false (REST 폴링 비활성화)

WebSocket 단절 감지
  → 자동으로 REST 폴링 전환 (5초 주기, ~12회/분)
  → Exponential Backoff로 재연결 시도 (1s → 2s → 4s → ... → 30s)

WebSocket 재연결 성공
  → 이전 구독 목록 자동 복구
  → REST 폴링 다시 비활성화
```

**핵심 설계 포인트 — TanStack Query 캐시를 Single Source of Truth로 활용:**

WebSocket과 REST 두 데이터 소스가 존재하지만, 상태를 이중으로 관리하지 않습니다. WebSocket이 받은 체결가를 `queryClient.setQueryData`로 TanStack Query 캐시에 직접 주입하여, `useStockPrice` 훅을 사용하는 모든 컴포넌트가 자동으로 최신 가격을 반영합니다.

```typescript
// useWebSocket.ts — WebSocket 메시지를 TanStack Query 캐시에 주입
queryClient.setQueryData(['quote', symbol], (prev) => ({
  ...prev,
  currentPrice: trade.p,
  timestamp: trade.t
}));
```

UI 컴포넌트는 데이터가 WebSocket에서 왔는지 REST에서 왔는지 전혀 모릅니다.

**트레이드오프:**

- **얻은 것**: 어떤 네트워크 환경에서도 시세 갱신이 끊기지 않는 안정성
- **감수한 것**: 재연결 + 구독 복구 로직의 복잡도 증가
- **대응**: 구독 목록을 `Set<string>` ref로 관리하여 재연결 시 자동 복구

### 2.5 priceMap 데이터 소스 추상화 패턴

**배경**: 미국 주식(Finnhub REST API)과 한국 주식(Mock)이라는 완전히 다른 데이터 소스를 처리하되, `PortfolioTable` UI는 동일해야 했습니다.

**선택지 비교:**

| 항목                      | 시장별 별도 테이블 | 테이블 내부에서 분기 | **priceMap 추상화 (선택)** |
| ------------------------- | ------------------ | -------------------- | -------------------------- |
| 코드 중복                 | 테이블 로직 2벌    | 없음                 | 없음                       |
| 테이블의 데이터 소스 의존 | 없음               | 높음                 | **없음**                   |
| 새 시장 추가 시           | 테이블 1벌 추가    | 분기 조건 추가       | **섹션 컴포넌트만 추가**   |

**구현:**

```
USPortfolioSection → useMultipleStockPrices() → priceMap: { AAPL: 195.2, MSFT: 420.1 }
                                                            ↓
KRPortfolioSection → fetchKrxMockQuote()      → priceMap: { 005930: 72500, 000660: 178000 }
                                                            ↓
                                              PortfolioTable (priceMap만 받음)
```

"일본 주식을 추가한다면?" → `JPPortfolioSection`만 만들면 됩니다. PortfolioTable, StockForm, ProfitBadge는 변경 없습니다. 이는 금융 시스템에서 여러 거래소/데이터 벤더를 통합할 때 사용하는 **어댑터 패턴의 프론트엔드 버전**입니다.

### 2.6 localStorage 2계층 아키텍처 — Store + Hook 분리

**배경**: localStorage로 포트폴리오 데이터를 저장하되, 컴포넌트에서 직접 조작하면 React 렌더링과 동기화되지 않는 문제가 있었습니다. 또한 향후 서버 API로 교체할 가능성을 고려해야 했습니다.

**설계:**

```
portfolioStore.ts (Store 계층 — React 의존성 제로)
  addStock()     → localStorage.setItem()
  loadPortfolio() → localStorage.getItem() → JSON.parse()

usePortfolio.ts (Hook 계층 — Store를 React에 연결하는 어댑터)
  add(data)      → addStock(data) + refresh() (React 상태 갱신)
  useState(() => loadPortfolio()) — 초기값도 Store에서
```

**결정 근거**: "localStorage 대신 서버 API로 교체한다면?" → **Store 파일 하나만 수정**하면 됩니다. Hook과 컴포넌트는 변경 없습니다. Store의 `addStock()`, `loadPortfolio()`는 React 없이 동작하는 순수 함수이므로 **독립적 단위 테스트**가 가능합니다.

### 2.7 Gemini API 선택 — AI 종목 요약 모델 선정

**배경**: 캔들스틱 차트 아래에 종목의 최근 동향을 2~3줄로 요약하는 AI 기능을 추가하면서, 무료로 사용할 수 있는 LLM API를 선택해야 했습니다.

**선택지 비교:**

| 항목           | OpenAI GPT-4o mini | Claude API (Haiku) | **Gemini API (선택)**   |
| -------------- | ------------------- | ------------------- | ----------------------- |
| 카드 등록 필요 | 필요                | 필요                | **불필요**              |
| 비용           | $5 선불             | $5 선불             | **무료**                |
| 무료 한도      | —                   | —                   | **하루 1,000회**        |
| 난이도         | 쉬움                | 쉬움                | 쉬움                    |
| 모델           | gpt-4o-mini         | claude-haiku        | **gemini-2.5-flash-lite** |

**결정 근거**: 세 API 모두 종목 요약 수준의 텍스트 생성에는 충분한 성능입니다. 결정적 차이는 **진입 장벽**이었습니다.

1. **카드 등록 불필요**: OpenAI와 Claude는 API 키 발급에 결제 카드 등록이 필수. Gemini는 Google 계정만으로 즉시 발급 가능. 프로젝트를 clone한 누구든 바로 테스트할 수 있습니다.
2. **무료 한도 충분**: gemini-2.5-flash-lite는 하루 1,000회 무료. 종목 요약은 종목 선택 시 1회 호출 + 10분 캐싱(`staleTime`)이므로 개인 포트폴리오 용도에 충분합니다.
3. **thinking 토큰 낭비 없음**: gemini-2.5-flash-lite는 경량 모델로 불필요한 추론 토큰을 소비하지 않아, 간단한 요약 작업에 최적입니다.

**트레이드오프:**

- **얻은 것**: 진입 장벽 제로(카드 불필요), 무료 운영, 빠른 응답 속도
- **감수한 것**: Gemini의 금융 도메인 정확도가 GPT-4o 대비 다소 낮을 수 있음
- **대응**: 프롬프트에 "투자 권유 문구 제외" 조건을 명시하고, 요약 UI에 "AI 생성 콘텐츠" 라벨을 표시하여 사용자가 참고 수준으로 인식하도록 설계

---

## 3. 주요 구현 상세

### 3.1 WebSocket 실시간 시세 + 폴링 자동 전환

**동작 흐름:**

```
앱 실행 → WebSocket 연결 (wss://ws.finnhub.io)
  → 등록된 종목 전체 구독 (최대 50개)
  → 체결가 수신 시 TanStack Query 캐시 직접 업데이트
  → 단절 감지 시 REST 5초 폴링으로 자동 전환
  → Exponential Backoff 재연결 (1s → 2s → 4s → ... → 30s)
  → 재연결 성공 시 이전 구독 목록 자동 복구
```

**핵심 코드 — 폴링 자동 전환:**

```typescript
// useStockPrice.ts
refetchInterval: isWebSocketConnected ? false : POLLING_INTERVAL; // 5000ms
```

WebSocket 연결 상태 하나로 REST 폴링의 ON/OFF가 결정됩니다. WebSocket 정상 시 API 호출 0회, 단절 시에도 분당 ~12회로 한도(60회) 내에서 운영됩니다.

**핵심 코드 — 동적 구독 관리:**

종목을 추가/삭제하면 WebSocket 구독이 자동으로 동기화됩니다. 현재 구독 목록을 `Set<string>` ref로 관리하여, 변경분(delta)만 subscribe/unsubscribe합니다.

**기술적 챌린지:**

- WebSocket `onclose` 핸들러에서의 재연결과 컴포넌트 unmount 시 정리를 구분해야 했습니다. unmount 시에는 `onclose`를 명시적으로 null로 설정하여 불필요한 재연결을 방지했습니다.

**UI/UX 고민:**

- WebSocket 단절 시 사용자에게 "폴링 전환 중" 노란 배너를 표시하여 데이터 지연 가능성을 투명하게 알립니다.
- 재연결 중에는 노란 점이 **pulsing 애니메이션**으로 현재 복구 시도 중임을 시각적으로 전달합니다.

### 3.2 다중 종목 API Rate Limit 대응

**문제**: 10종목 × 5초 폴링 = 분당 120회. Finnhub 분당 60회 한도를 초과합니다.

**해결 — TanStack Query 개별 캐시 + staleTime:**

```typescript
// useMultipleStockPrices.ts — 고정 10개 Hook 호출
const q0 = useStockPrice(symbols[0], isWebSocketConnected);
const q1 = useStockPrice(symbols[1], isWebSocketConnected);
// ... q2~q9
```

React Hook 규칙상 조건부 호출이 불가능하므로, 10개 Hook을 고정 선언하되 `enabled: !!symbol`로 빈 심볼은 API 호출을 스킵합니다.

TanStack Query의 `staleTime` 내 동일 쿼리는 캐시를 반환하므로, 실제 분당 호출은 약 12회로 제어됩니다. 에러도 종목별로 독립 — AAPL 조회 실패가 MSFT에 영향을 주지 않습니다.

**트레이드오프**: 최대 10종목 제한 + q0~q9 고정 선언의 반복 코드. 4주차 WebSocket 구현으로 50종목까지 무제한 수신이 가능해지면서 해소되었습니다.

### 3.3 ECharts 3종 차트 — 파이/라인/캔들스틱

**파이차트**: 종목별 포트폴리오 비중을 평가금액(`현재가 × 수량`) 기준으로 시각화합니다.

**라인차트 — 스냅샷 없이 과거 포트폴리오 손익 복원:**

일별 포트폴리오 스냅샷을 저장하지 않고, 각 종목의 과거 캔들 데이터로부터 "그 날 이 포트폴리오를 보유했다면?" 손익을 역산합니다.

```typescript
// buildPortfolioHistoryFromMap — 핵심 로직
allDates.forEach((date) => {
  let totalValue = 0;
  stocks.forEach((stock) => {
    const candle = candleMap[stock.symbol]?.find((c) => c.date === date);
    if (candle) totalValue += candle.close * stock.quantity;
  });
  history.push({ date, profitLoss: totalValue - totalCost });
});
```

**캔들스틱차트**: 개별 종목의 OHLCV 데이터를 90일 기준으로 표시합니다. 한국식 색상 컨벤션(상승: 빨강, 하락: 파랑)을 적용했습니다.

**기술적 챌린지 — 결정론적 Mock 데이터:**

한국 주식 Mock 차트에서 `Math.random()`을 사용하면 리렌더링마다 차트가 바뀌는 문제가 발생했습니다. **LCG(선형 합동 생성기) 기반 Seeded PRNG**를 구현하여 동일 심볼은 항상 동일한 차트를 생성하도록 했습니다.

### 3.4 포트폴리오 CRUD + 수익률 계산

**수익률 계산 공식:**

```typescript
// utils/calculator.ts — 순수 함수 (React 의존성 없음)
수익률 = (현재가 - 매입가) / 매입가 × 100
평가손익 = (현재가 - 매입가) × 수량
```

0으로 나누기 방어(매입가 0원 입력)를 포함합니다. 금융 계산은 엣지 케이스 방어가 필수입니다.

**UI/UX 고민 — 한국식 색상 컨벤션:**

증권 앱에서 사용하는 **수익 빨강(`#ef4444`), 손실 파랑(`#3b82f6`)** 컨벤션을 적용했습니다. 미국식(수익 초록, 손실 빨강)과 반대인데, 한국 금융권 타겟이므로 한국 관례를 따랐습니다.

### 3.5 한국 주식 Mock 시뮬레이션

**장중 시간(09:00~15:30 KST) 기반 현실적 시뮬레이션:**

```typescript
// mockKrx.ts
function isKrxMarketOpen(): boolean {
  // toLocaleString으로 KST 변환 — 서버 배포 위치에 무관하게 정확
  const kstTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
  // 분 단위로 09:00(540) ~ 15:30(930) 범위 체크
}
```

`toLocaleString`에 `timeZone` 파라미터를 사용하여 **Vercel 서버가 어느 리전에 배포되든** 정확한 KST 시간을 판정합니다. offset 기반 계산이 아니라 IANA 타임존을 사용하므로 서머타임 이슈도 없습니다.

장중에는 기준가 ±3% 범위에서 변동, 장외에는 기준가를 그대로 반환합니다. 삼성전자, SK하이닉스 등 10개 대표 종목의 기준가를 하드코딩하여 현실적인 가격대를 유지합니다.

### 3.6 AI 종목 동향 요약 — Gemini 연동

**동작 흐름:**

```
사용자가 캔들스틱 차트에서 종목 선택
  → useStockSummary(symbol, name, market) 호출
  → TanStack Query가 fetchStockSummary() 실행
  → Gemini 2.5 Flash Lite API에 한국어 프롬프트 전송
  → 2~3줄 요약 텍스트 반환 → 캔들스틱 차트 아래에 표시
  → 10분간 캐싱 (staleTime) — 같은 종목 재선택 시 API 재호출 방지
```

**핵심 코드 — Gemini API 호출:**

```typescript
// services/gemini.ts
const prompt = `${marketLabel} 주식 ${name}(${symbol})의 최근 동향을
  2~3줄로 간결하게 한국어로 요약해주세요.
  주가 흐름, 주요 이슈, 시장 전망 위주로 작성하되,
  투자 권유 문구는 제외해주세요.`;

const response = await fetch(
  `${GEMINI_BASE_URL}/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
  {
    method: 'POST',
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 256 },
    }),
    signal: controller.signal, // 15초 타임아웃
  }
);
```

**핵심 코드 — TanStack Query 캐싱:**

```typescript
// hooks/useStockSummary.ts
export function useStockSummary(symbol: string, name: string, market: Market) {
  return useQuery({
    queryKey: ['stockSummary', symbol, market],
    queryFn: () => fetchStockSummary(symbol, name, market),
    enabled: !!symbol && !!name,
    staleTime: 10 * 60 * 1000, // 10분 캐시 — 동향 요약은 자주 변하지 않음
    retry: 1,
    retryDelay: 3000,
  });
}
```

**기술적 챌린지:**

- **모델 deprecation 대응**: 초기에 `gemini-1.5-flash`를 사용했으나 404 에러 발생. Gemini API 문서 확인 결과 해당 모델이 2026년 지원 종료된 것을 확인하고 `gemini-2.5-flash-lite`로 마이그레이션. 외부 API 모델의 생명주기를 고려한 설계가 필요함을 체감했습니다.
- **API 키 미설정 방어**: `VITE_GEMINI_API_KEY`가 없을 때 명확한 에러 메시지를 throw하여, 환경변수 미설정과 API 오류를 구분할 수 있도록 했습니다.

**UI/UX 고민:**

- **스켈레톤 UI**: API 응답 대기 중 3줄 길이의 회색 막대가 **pulse 애니메이션**으로 표시되어, 사용자가 "무언가 로딩 중"임을 즉시 인지할 수 있습니다. 빈 공간이나 스피너 대비 레이아웃 시프트가 없습니다.
- **에러 시 재시도 버튼**: API 실패 시 에러 메시지와 함께 "재시도" 버튼을 표시하여, 사용자가 능동적으로 복구할 수 있습니다.
- **"AI 종목 요약" + "Powered by Gemini" 라벨**: AI가 생성한 콘텐츠임을 명시하여 사용자가 투자 판단이 아닌 참고 정보로 인식하도록 설계했습니다. 금융 서비스에서 AI 생성 콘텐츠의 투명성은 규제 관점에서도 중요합니다.
- **React.memo 적용**: symbol 변경 시에만 리렌더링되도록 최적화. 부모의 가격 갱신 리렌더링에 영향받지 않습니다.

---

## 4. 성능 최적화

### 4.1 React.memo + useMemo 조합 — 리렌더링 80% 감소

**문제**: 5초 폴링으로 가격이 갱신되면 부모 컴포넌트(`USPortfolioSection`)가 리렌더링되면서, props가 변하지 않은 차트 컴포넌트까지 매번 리렌더링되었습니다.

**측정 (최적화 전)**: 30초간 차트 컴포넌트 렌더링 **약 20회**

**3단계 최적화 프로세스:**

| 단계  | 적용                 | 30초간 렌더링 | 비고                      |
| ----- | -------------------- | ------------- | ------------------------- |
| 1단계 | 최적화 없음          | 약 20회       | 기준 측정                 |
| 2단계 | React.memo만         | 4회           | props 동일하면 스킵       |
| 3단계 | React.memo + useMemo | **4회**       | option 객체 재생성도 방지 |

**핵심 — React.memo만으로는 부족한 이유:**

React.memo는 props의 얕은 비교로 리렌더링을 스킵하지만, 실제 렌더링이 발생할 때(가격 변경) ECharts option 객체가 매번 새로 생성됩니다. `useMemo`로 option 재생성을 deps 기반으로 제한해야 ECharts 내부 diff 비용까지 절감됩니다.

```typescript
// PieChart.tsx
const PieChart = memo(function PieChart({ data, market }: PieChartProps) {
  const option = useMemo(() => ({
    // data/market이 변경될 때만 option 객체 재생성
    series: [{ type: 'pie', data: data.map(...) }],
  }), [data, market]);

  return <ReactECharts option={option} notMerge={true} />;
});
```

**부모-자식 협력 구조:**

자식에 `memo`를 걸어도, 부모가 매 렌더마다 새 배열을 전달하면 무의미합니다. 부모(`USPortfolioSection`)에서도 `useMemo`로 차트 데이터의 참조 안정성을 확보했습니다.

```typescript
// USPortfolioSection.tsx
const pieData = useMemo<PieChartItem[]>(
  () =>
    stocks
      .filter((s) => priceMap[s.symbol] !== undefined)
      .map((s) => ({
        name: s.name,
        symbol: s.symbol,
        value: calcMarketValue(priceMap[s.symbol], s.quantity)
      })),
  [stocks, priceMap]
);
```

**결과**: 잔존 4회는 실제 가격 변동으로 인한 **정당한 리렌더링**. 불필요한 렌더링 0회 달성.

---

## 5. 예외 처리 및 안정성 설계

금융 서비스는 "문제가 생겨도 서비스가 중단되지 않는 것"이 핵심입니다. 아래 시나리오별로 사용자 경험이 끊기지 않도록 설계했습니다.

| 예외 상황         | 처리 전략                                                                 | 사용자에게 보이는 것                   |
| ----------------- | ------------------------------------------------------------------------- | -------------------------------------- |
| API 호출 실패     | TanStack Query `retry: 3` + exponential backoff (1s → 2s → 4s → 최대 30s) | 에러 메시지 + "재시도" 버튼            |
| 요청 타임아웃     | AbortController 10초 제한 (Gemini는 15초)                                 | "응답 시간 초과" 메시지                |
| 잘못된 종목 코드  | Finnhub가 HTTP 200 + 모든 값 0으로 응답 → `data.c === 0` 체크             | 즉각 인라인 피드백                     |
| WebSocket 단절    | REST 폴링 자동 전환 + Exponential Backoff 재연결                          | "폴링 전환 중" 노란 배너               |
| 장 마감           | `useMarketStatus` 훅이 ET/KST 기반 장 상태 감지                           | "장 마감" 회색 배너                    |
| 네트워크 오프라인 | `useOnlineStatus` 훅이 `navigator.onLine` 감지                            | 오프라인 배너                          |
| 컴포넌트 에러     | ErrorBoundary로 차트별 격리                                               | 에러난 차트만 fallback UI, 나머지 정상 |
| AI 요약 실패      | `retry: 1` + 재시도 버튼 제공                                             | 에러 메시지 + "재시도" 버튼            |
| Gemini 키 미설정  | 환경변수 체크 후 명확한 에러 throw                                        | "API 키 미설정" 메시지                 |

**ErrorBoundary 격리 전략:**

각 차트를 개별 ErrorBoundary로 감싸서, 캔들스틱 차트에서 에러가 나도 파이차트와 라인차트는 정상 동작합니다. 금융 앱에서 하나의 차트 오류가 전체 포트폴리오 화면을 중단시키면 안 되기 때문입니다.

**장 상태 타임존 처리:**

```typescript
// useMarketStatus.ts — 서머타임 자동 대응
const etTime = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
// ET 기준 09:30~16:00 평일 → 장중
```

offset 계산이 아닌 `America/New_York` IANA 타임존을 사용하여 **서머타임(EDT/EST) 전환을 자동 처리**합니다. 별도 라이브러리 없이 브라우저 내장 `toLocaleString`으로 해결했습니다.

---

## 6. 트러블슈팅 기록

### 6.1 Finnhub Candle API 403 — 3단계 Graceful Degradation

**증상**: 캔들스틱 차트용 `/stock/candle` API가 갑자기 403 에러를 반환하기 시작했습니다.

**원인 분석 과정:**

1. 처음에는 API 키 문제를 의심 → 다른 엔드포인트(`/quote`)는 정상 동작
2. Finnhub 문서 확인 → **캔들스틱 데이터가 유료 전용으로 전환**된 것을 확인
3. 무료 플랜에서는 더 이상 과거 시세 데이터를 받을 수 없게 됨

**해결 — 3단계 폴백 전략:**

```
1순위: Alpha Vantage TIME_SERIES_DAILY (무료, 일 25회)
  → 캐싱 전략으로 25회 한도 내 운영 (staleTime: 5분)
  ↓ 실패 시
2순위: 현재가 기반 Mock 캔들 생성
  → Seeded PRNG로 현재가에서 역산하여 90일치 캔들 생성
  ↓
3순위: "시뮬레이션 데이터" 배너 표시
  → 사용자에게 데이터가 실제가 아님을 투명하게 고지
```

**배운 점:**

- 외부 API는 언제든 정책이 바뀔 수 있으므로, **폴백 전략을 사전에 설계**해야 합니다.
- 데이터 품질이 달라지는 경우 사용자에게 **투명하게 고지**하는 것이 금융 서비스의 기본입니다.
- API 용도를 분리(실시간: Finnhub, 과거: Alpha Vantage)한 설계가 폴백 구현을 용이하게 했습니다.

### 6.2 Gemini 모델 Deprecation — gemini-1.5-flash 404 에러

**증상**: AI 종목 요약 기능에서 Gemini API 호출 시 404 에러 반환.

```
models/gemini-1.5-flash is not found for API version v1beta,
or is not supported for generateContent.
```

**원인 분석 과정:**

1. API 키 오류 의심 → 키 자체는 정상 (다른 모델로 테스트 성공)
2. Gemini API 공식 문서 확인 → `gemini-1.5-flash` 모델이 2026년 지원 종료(deprecated)된 것을 확인
3. 현재 사용 가능한 Flash 계열: `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-3-flash-preview`

**해결**: `gemini-2.5-flash-lite`로 모델 변경. 종목 요약이라는 간단한 작업에 경량 모델이 적합하고, 무료 한도(하루 1,000회)가 가장 여유 있는 모델이었습니다.

**배운 점:**

- LLM API는 모델 생명주기가 짧아 **언제든 deprecated될 수 있습니다**. 모델명을 상수로 분리하고, fallback 모델을 고려한 설계가 필요합니다.
- 6.1의 Finnhub Candle API 403과 동일한 패턴 — 외부 API 의존 시 **정책 변경 리스크를 항상 고려**해야 합니다.

---

## 7. 프로젝트를 통해 배운 것

### 기술적 성장

- **WebSocket 실시간 통신**: 연결/단절/재연결 생명주기 관리, 구독 상태 관리, REST 폴링과의 자동 전환 메커니즘을 직접 구현하면서 실시간 통신의 복잡도를 체감했습니다.
- **TanStack Query 심화 활용**: 단순 데이터 페칭을 넘어, WebSocket 데이터를 캐시에 직접 주입하는 패턴(`setQueryData`)과 조건부 폴링(`refetchInterval` 동적 전환)을 적용했습니다.
- **측정 기반 최적화**: "느린 것 같다"는 감이 아닌, console.log와 Profiler로 수치를 먼저 측정하고 최적화 후 개선폭을 정량적으로 입증하는 습관을 체득했습니다.
- **LLM API 연동**: Gemini API를 프론트엔드에서 직접 호출하고, 프롬프트 엔지니어링으로 응답 품질을 제어하며, 캐싱 전략으로 API 호출을 최소화하는 경험을 했습니다.

### 설계 관점 인사이트

- **데이터 소스 추상화**: `priceMap` 패턴을 통해 UI 컴포넌트가 데이터 출처에 의존하지 않는 구조의 가치를 체감했습니다. 실제로 Finnhub Candle API가 유료 전환되었을 때, UI 변경 없이 Alpha Vantage로 교체할 수 있었습니다.
- **2계층 아키텍처**: Store(저장) + Hook(React 연결) 분리가 단위 테스트와 저장소 교체를 얼마나 용이하게 하는지 경험했습니다.
- **외부 API 의존 관리**: Finnhub 403, Gemini 404 두 건의 외부 API 장애를 경험하면서, 단일 API 의존의 위험성과 폴백 전략의 중요성을 체감했습니다.

### 금융 도메인 특수성

- 한국/미국 시장의 색상 컨벤션 차이, 장중/장외 시간 처리, 타임존 이슈(서머타임), 거래소별 데이터 정책의 차이를 프론트엔드 레벨에서 어떻게 반영하는지 학습했습니다.
- 금융 서비스에서는 "데이터가 없을 때" 어떻게 보여줄지가 "데이터가 있을 때"만큼 중요하다는 것을 깨달았습니다.
- AI 생성 콘텐츠를 금융 서비스에 적용할 때, **투명성 라벨**과 **투자 권유 제외** 같은 규제 관점 고려가 필수적임을 인식했습니다.

---

## 8. 향후 개선 계획

| 개선 항목          | 현재 상태                      | 개선 방향                                     |
| ------------------ | ------------------------------ | --------------------------------------------- |
| 한국 주식 실시간   | Mock 시뮬레이션                | KIS Open API 연동 (계좌 개설 후)              |
| 종목 리스트 가상화 | 미적용                         | react-window로 대용량 종목 대응               |
| PWA                | 미적용                         | Service Worker + 오프라인 캐싱                |
| 테스트 커버리지    | 미작성                         | calculator.ts 단위 테스트 + Store 통합 테스트 |
| 목표가 알림        | 미구현                         | Web Push Notification API                     |
| AI 요약 고도화     | 단순 텍스트 요약               | 뉴스 소스 연동 + 감성 분석 지표 추가          |

**기술 부채 인지:**

- `useMultipleStockPrices`의 q0~q9 하드코딩은 WebSocket 도입으로 의미가 줄었으나, REST 폴백 시에는 여전히 사용됩니다. 향후 동적 Hook 패턴(배열 기반)으로 리팩토링을 검토 중입니다.
- Alpha Vantage 일 25회 한도는 여러 사용자가 동시에 접속하면 빠르게 소진될 수 있습니다. 캔들 데이터의 서버사이드 캐싱 레이어가 필요합니다.
- Gemini API 모델 deprecation 경험을 반영하여, 모델명을 환경변수로 분리하거나 런타임에 모델 가용성을 체크하는 로직 도입을 검토 중입니다.
