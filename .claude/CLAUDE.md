# StockFolio — Claude Code 컨텍스트 파일

> 이 파일은 Claude Code가 자동으로 읽는 프로젝트 컨텍스트입니다.
> 코드 작성 시 아래 내용을 항상 숙지하고 반영하세요.

---

## 프로젝트 개요

- **프로젝트명**: StockFolio — 실시간 주식 포트폴리오 트래커
- **1순위 목적**: 금융권 포트폴리오 (NH투자증권, IBK기업은행 IT 직군 타겟)
- **구조**: 프론트엔드 전용 (백엔드 없음, 배포는 Vercel)
- **데이터 저장**: localStorage (보유 종목, 매입가, 수량)

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | React 18 + TypeScript |
| 상태 관리 | TanStack Query v5 |
| 데이터 시각화 | ECharts (Apache) |
| 실시간 통신 | Finnhub WebSocket + REST 폴링 백업 |
| 스타일링 | Tailwind CSS |
| 빌드 도구 | Vite |
| 배포 | Vercel |

---

## 핵심 의사결정 (Decision Log)

### 1. Finnhub을 선택한 이유 (Alpha Vantage 대신)

| 항목 | Alpha Vantage (무료) | Finnhub (무료) |
|------|------|------|
| 호출 제한 | 일 25회 ❌ | 분당 60회 ✅ |
| WebSocket | 없음 ❌ | 있음 ✅ |
| 미국 주식 | 지원 | 지원 |
| 한국 주식 | 미지원 | 미지원 |

**결정 이유**: 5초 폴링 구현 시 Alpha Vantage 일 25회 제한은 즉시 초과. Finnhub 분당 60회로 실시간 데모 안정적 운영 가능.

### 2. 미국 주식 실시간 O, 한국 주식 Mock인 이유

**미국 주식 (실시간 가능)**
- NYSE/NASDAQ은 시장 데이터를 전 세계 서드파티에 재판매 허용
- Finnhub 같은 업체가 합법적으로 API로 제공 가능

**한국 주식 (Mock 사용)**
- KRX(한국거래소)는 폐쇄적 데이터 정책 — 지정 업체 외 재판매 불가
- KIS Open API: 실제 증권 계좌 + 개인 인증 필요 → 공개 데모 불가
- 네이버/다음 비공식 크롤링: 이용약관 위반 가능성

**결정**: 한국 주식 탭은 장중 시간 기반 Realistic Mock 시뮬레이션으로 구현.
README에 "KIS API 연동 구조로 설계, 데모는 Mock으로 시뮬레이션" 명시.

### 3. ECharts 선택 이유 (Recharts, Chart.js 대신)

| 항목 | Recharts | Chart.js | ECharts (선택) |
|------|------|------|------|
| 캔들스틱 차트 | ❌ 미지원 | △ 플러그인 필요 | ✅ 기본 지원 |
| 금융권 실무 사용 | 낮음 | 보통 | 높음 |
| 대용량 렌더링 성능 | 보통 | 보통 | 우수 |
| 학습 난이도 | 쉬움 | 보통 | 높음 |

**결정 이유**: 캔들스틱 차트 기본 지원 + 금융권 실무 사용 라이브러리 경험 확보를 위해 ECharts 선택. Recharts가 더 쉽지만 캔들스틱 미지원으로 제외. 어려운 라이브러리를 선택한 의사결정 근거 자체가 면접 어필 포인트.

### 4. WebSocket + 폴링 백업 구조를 선택한 이유

**Finnhub WebSocket 무료 플랜 제한 사항**

| 항목 | 제한 |
|------|------|
| 동시 구독 가능 종목 수 | 최대 50개 |
| 데이터 수신 횟수 | 무제한 |
| 동시 연결 수 | 1개 |

동시 구독 가능 종목 수 최대 50개. 개인 포트폴리오 특성상 초과 가능성 낮으나, 초과 시 초과 종목은 REST 폴링으로 대체.

**WebSocket은 API 호출 횟수(분당 60회)에 카운트되지 않음**

| 상황 | API 한도 소비 |
|------|------|
| WebSocket 정상 연결 중 | 없음 (무제한 수신) |
| WebSocket 단절 → 폴링 전환 시 | 분당 최대 12회 (5초 주기 기준) |

**결론**: WebSocket이 안정적으로 유지되는 한 분당 60회 한도 걱정 없음. 단절 시 폴링 전환해도 분당 12회 소비로 한도(60회) 내 충분히 여유 있음.

**WebSocket 단점 및 대응 전략**

| WebSocket 단점 | 대응 방법 |
|------|------|
| 방화벽/프록시 환경에서 차단될 수 있음 | 차단 감지 시 REST 폴링으로 자동 전환 |
| 단절 시 재연결 + 구독 복구 로직 필요 | 재연결 로직 + 구독 목록 상태 관리 |
| 장외 시간엔 체결가 데이터 없음 | 장외 시간엔 마지막 종가 캐싱으로 대체 |

**결정 이유**: WebSocket만 단독 사용 시 특정 네트워크 환경에서 동작 불가 위험. REST 폴링을 백업으로 두어 어떤 환경에서도 시세 갱신이 끊기지 않도록 설계. WebSocket 단점을 인지하고 대응한 설계 자체가 면접 어필 포인트.

```
WebSocket 연결 실패 또는 단절
        ↓
자동으로 REST 폴링 (5초 주기)으로 전환
        ↓
WebSocket 재연결 성공 시 다시 WebSocket으로 전환
```

### 5. 장중/장외 처리 전략

```
미국 장 열림 (한국 밤 10시 ~ 새벽 5시): Finnhub WebSocket 실시간 체결가
미국 장 닫힘 (한국 낮):                  마지막 종가 표시 + "장 마감" UI
한국 장 (오전 9시 ~ 오후 3시 30분):      Mock 시뮬레이션 활성화
```

---

## 폴더 구조

```
src/
├── components/
│   ├── charts/          # ECharts 차트 컴포넌트
│   │   ├── CandlestickChart.tsx
│   │   ├── PieChart.tsx
│   │   └── LineChart.tsx
│   ├── portfolio/       # 포트폴리오 관련 컴포넌트
│   │   ├── PortfolioTable.tsx
│   │   ├── StockForm.tsx
│   │   └── ProfitBadge.tsx
│   └── ui/              # 공통 UI (에러, 로딩, 상태 표시)
│       ├── ErrorBoundary.tsx
│       ├── MarketStatusBanner.tsx
│       └── OfflineBanner.tsx
├── hooks/
│   ├── useStockPrice.ts     # TanStack Query + Finnhub REST
│   ├── useWebSocket.ts      # Finnhub WebSocket 연결/재연결
│   ├── useMarketStatus.ts   # 장중/장외 감지
│   └── usePortfolio.ts      # localStorage CRUD
├── services/
│   ├── finnhub.ts       # Finnhub API 호출 함수
│   └── mockKrx.ts       # 한국 주식 Mock 데이터 생성
├── store/
│   └── portfolioStore.ts    # localStorage 상태 관리
├── types/
│   └── stock.ts         # 공통 타입 정의
├── utils/
│   ├── calculator.ts    # 수익률/손익 계산 함수
│   └── formatter.ts     # 통화/퍼센트 포맷
└── constants/
    └── api.ts           # API 엔드포인트, 환경변수 키
```

---

## 핵심 구현 주의사항

### Finnhub WebSocket
```typescript
// 연결 엔드포인트
wss://ws.finnhub.io?token=${VITE_FINNHUB_API_KEY}

// 구독 메시지 형식
{ type: 'subscribe', symbol: 'AAPL' }

// 재연결 로직 필수 — 단절 감지 시 자동 재연결 + 구독 복구
```

### TanStack Query 설정
```typescript
// WebSocket 단절 시 폴링 백업
refetchInterval: isWebSocketConnected ? false : 5000
// 오류 시 exponential backoff 재시도
retry: 3, retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000)
```

### 수익률 계산
```typescript
// 수익률 = (현재가 - 매입가) / 매입가 * 100
// 평가손익 = (현재가 - 매입가) * 수량
// 한국식 색상: 수익 빨강(#ef4444), 손실 파랑(#3b82f6)
```

### Mock 데이터 (한국 주식)
```typescript
// 장중 시간(09:00~15:30)에만 시뮬레이션 활성화
// 기준가 기반으로 ±3% 범위 랜덤 변동
// OHLCV 구조 유지 (캔들스틱 호환)
```

---

## 성능 최적화 원칙

- 차트 컴포넌트는 **React.memo** 필수 적용
- 수익률 계산은 **useMemo** 사용 (가격 변경 시에만 재계산)
- 실시간 갱신 시 **변경된 종목만 부분 업데이트** (전체 리렌더링 방지)
- 최적화 전/후 리렌더링 횟수를 **React DevTools Profiler**로 측정하고 주석에 수치 기록

---

## 예외 처리 체크리스트

- [ ] API 호출 실패 → 에러 메시지 + 재시도 버튼
- [ ] 타임아웃 → AbortController 적용
- [ ] 잘못된 종목 코드 → 즉각 인라인 피드백
- [ ] WebSocket 단절 → 자동 재연결 + REST 폴링 전환
- [ ] 장 마감 상태 → "장 마감" UI 표시
- [ ] 네트워크 오프라인 → 오프라인 배너 표시
- [ ] 컴포넌트 에러 → Error Boundary로 격리

---

## 면접 어필을 위해 코드에 반드시 남길 것

1. **의사결정 주석**: 중요한 로직마다 "왜 이렇게 했는지" 한 줄 주석
2. **성능 수치 주석**: 최적화 후 리렌더링 횟수 등 측정값
3. **트러블슈팅 주석**: 문제 발생 → 원인 → 해결 흐름

```typescript
// [성능] React.memo 적용 후 리렌더링 횟수: 12회 → 2회 감소
// [의사결정] WebSocket 단절 시 REST 폴링으로 전환 — UX 연속성 보장
// [트러블슈팅] 장외 시간 WebSocket 체결가 미수신 → 마지막 종가 캐싱으로 해결
```

---

## 환경변수

```
VITE_FINNHUB_API_KEY=    # Finnhub API 키
```

---

## 현재 개발 단계

- [ ] 1주차: 프로젝트 세팅 + Finnhub API 연동
- [ ] 2주차: 포트폴리오 CRUD + 계산 로직
- [ ] 3주차: ECharts 차트 구현
- [ ] 4주차: WebSocket 실시간 갱신
- [ ] 5주차: 예외 처리 + 성능 최적화
- [ ] 6주차: 배포 + README 정리
