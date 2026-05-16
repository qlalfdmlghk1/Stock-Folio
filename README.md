# StockFolio

> 실시간 주식 포트폴리오 트래커 — Finnhub WebSocket 기반 실시간 시세 + 가상 보유 종목 수익률 시뮬레이션

<!-- TODO: 메인 화면 스크린샷 또는 데모 GIF 추가 -->

- **데모 URL**: <!-- TODO: Vercel 배포 후 URL 삽입 -->
- **타겟**: 금융권 IT 직군 포트폴리오 (NH투자증권, IBK기업은행)
- **구조**: 프론트엔드 전용 + Vercel Serverless Proxy (API 키 서버사이드 은닉)

---

## 핵심 특징

| 항목 | 설명 |
|------|------|
| 실시간 시세 | Finnhub WebSocket으로 미국 주식 체결가 수신 (API 한도 비차감) |
| 폴링 백업 | WebSocket 단절 감지 시 REST 폴링(5초)으로 자동 전환 |
| 한국 주식 | 공공데이터포털 KRX API + 장중 시간 기반 Mock fallback |
| API 키 보안 | Vercel Serverless Function 프록시로 키를 서버사이드 격리 |
| 시각화 | ECharts 파이 / 라인 / 캔들스틱 3종 차트 |
| 안정성 | Error Boundary, 오프라인 배너, 장 마감 UI 등 예외 처리 |

---

## 기술 스택 및 의사결정

| 구분 | 채택 기술 | 대안 | 채택 근거 |
|------|-----------|------|-----------|
| 프레임워크 | React 19 + TypeScript | — | 타입 안정성 + 생태계 |
| 서버 상태 | TanStack Query v5 | useEffect + fetch | 캐싱·폴링 주기 제어·자동 재시도 |
| 시각화 | **ECharts** | Recharts, Chart.js | 캔들스틱 기본 지원 + 금융권 실무 사용 |
| 실시간 통신 | Finnhub WebSocket | REST 폴링 단독 | WebSocket은 API 한도(분당 60회) 비차감 |
| 시세 데이터 | **Finnhub** | Alpha Vantage | 일 25회 vs 분당 60회 — 폴링 운영 가능 여부 차이 |
| 한국 시세 | 공공데이터포털 KRX | KIS Open API | KIS는 개인 계좌 + 인증 필요 → 공개 데모 불가 |
| 스타일링 | Tailwind CSS v4 | SCSS modules | 유틸리티 클래스 + 빠른 프로토타이핑 |
| 빌드 | Vite | Webpack/CRA | HMR 속도 + ESM 네이티브 |
| 배포 | Vercel | Netlify | Serverless Function 통합으로 API 키 프록시 구현 |

> 의사결정의 전체 근거(트레이드오프 비교표 포함)는 [`.claude/CLAUDE.md`](./.claude/CLAUDE.md) 참고.

---

## 아키텍처 한눈에 보기

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React App)                                        │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │ Portfolio CRUD │  │  ECharts 3종   │  │ Error UX     │  │
│  │ (localStorage) │  │  (memo+useMemo)│  │ (Boundary 외)│  │
│  └────────────────┘  └────────────────┘  └──────────────┘  │
│           │                  │                              │
│           └────────┬─────────┘                              │
│                    ▼                                        │
│       ┌──────────────────────────┐                          │
│       │ TanStack Query + WS Hook │                          │
│       └──────────────────────────┘                          │
└────────────┬────────────────────┬───────────────────────────┘
             │ REST (DEV: 직접)   │ WebSocket (직접 연결)
             │ REST (PROD: /api)  ▼
             ▼              wss://ws.finnhub.io
   ┌────────────────────┐
   │ Vercel Serverless  │
   │ /api/finnhub       │
   │ /api/alpha-vantage │
   │ /api/krx           │
   │ /api/gemini        │
   └─────────┬──────────┘
             │ API 키 주입 (process.env)
             ▼
   External APIs (Finnhub / Alpha Vantage / 공공데이터포털 / Gemini)
```

---

## 주요 기능

### 1. 포트폴리오 대시보드
- 미국 / 한국 주식 탭 분리
- 종목 등록·수정·삭제 (localStorage 영속)
- 수익률·평가손익 자동 계산 (한국식 색상: 수익 빨강, 손실 파랑)

<!-- TODO: 포트폴리오 테이블 + 수익률 표시 스크린샷 -->

### 2. 실시간 시세 갱신
- 앱 실행 → Finnhub WebSocket 연결 → 종목 전체 구독
- WebSocket 단절 감지 → REST 폴링(5초)으로 자동 전환
- 재연결 성공 시 WebSocket 복귀 + 구독 복구

<!-- TODO: 실시간 가격 갱신 GIF -->

### 3. ECharts 차트 3종
- **파이**: 종목별 비중
- **라인**: 기간별 손익 추이
- **캔들스틱**: 개별 종목 OHLCV

<!-- TODO: 차트 3종 스크린샷 -->

### 4. 예외 처리 UX
- WebSocket 단절 자동 재연결 + 폴링 백업
- 네트워크 오프라인 배너
- 장 마감 상태 UI
- Error Boundary로 차트/데이터 에러 격리

<!-- TODO: 오프라인 배너 / 장 마감 UI 스크린샷 -->

---

## 기술 어필 포인트 (상세 문서)

### Tech-Point — 설계·최적화 의사결정

| 주제 | 한 줄 요약 |
|------|-----------|
| [API Rate Limit 대응](./docs/tech-point/api-rate-limit-multi-stock-query.md) | Finnhub 분당 60회 한도 내에서 다종목 5초 폴링 운영 |
| [데이터 소스 추상화 (priceMap)](./docs/tech-point/data-source-abstraction-pricemap.md) | Finnhub와 KRX Mock을 `Record<string, number>` 하나로 통합 |
| [ECharts 성능 최적화](./docs/tech-point/echarts-memo-usememo-optimization.md) | React.memo + useMemo로 차트 리렌더링 80% 감소 |
| [localStorage 2계층 아키텍처](./docs/tech-point/localstorage-two-layer-architecture.md) | 저장소/동기화 계층 분리로 교체 비용 최소화 |

### Trouble-Shooting — 실제 발생 문제 + 해결

| 주제 | 한 줄 요약 |
|------|-----------|
| [Vite VITE_ 키 브라우저 노출](./docs/trouble-shooting/vite-api-key-browser-exposure.md) | Vercel Serverless Proxy로 API 키 서버사이드 격리 |
| [Finnhub Candle API 403](./docs/trouble-shooting/finnhub-candle-api-403.md) | 무료 플랜 변경 대응 → Alpha Vantage + Mock 이중 fallback |

### Features — 기능 상세 명세

- [포트폴리오 CRUD + 수익률 계산](./docs/features/portfolio-crud-calculation.md)
- [미국/한국 탭 + 실시간 시세 연동](./docs/features/market-tab-realtime-price.md)
- [Finnhub REST API 시세 조회](./docs/features/finnhub-rest-api-quote.md)
- [WebSocket 실시간 시세 + 폴링 백업](./docs/features/websocket-realtime-price.md)
- [한국 주식 Mock 시뮬레이션](./docs/features/krx-mock-simulation.md)
- [ECharts 데이터 시각화](./docs/features/echarts-data-visualization.md)

---

## 로컬 실행

### 환경변수

루트에 `.env` 파일을 만들고 다음 키를 설정합니다.

```env
# 클라이언트 노출 (WebSocket 전용 — 분당 60회 제한으로 남용 위험 낮음)
VITE_FINNHUB_API_KEY=your_finnhub_key

# 서버 전용 (Vercel 환경변수 또는 로컬 .env)
FINNHUB_API_KEY=your_finnhub_key
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
KRX_API_KEY=your_krx_public_data_key
GEMINI_API_KEY=your_gemini_key
```

> 키 분리 전략의 근거: [vite-api-key-browser-exposure.md](./docs/trouble-shooting/vite-api-key-browser-exposure.md)

### 실행

```bash
npm install
npm run dev       # 개발 서버 (Vite, 외부 API 직접 호출)
npm run build     # 프로덕션 빌드
npm run preview   # 빌드 결과 미리보기
npm run lint      # ESLint
```

> 프로덕션 빌드 시 `import.meta.env.DEV` 분기로 자동으로 `/api/*` Serverless 프록시 경로를 사용합니다.

---

## 디렉토리 구조

```
.
├── api/                      # Vercel Serverless Functions (API 키 프록시)
│   ├── finnhub.ts
│   ├── alpha-vantage.ts
│   ├── krx.ts
│   └── gemini.ts
├── src/
│   ├── components/
│   │   ├── charts/           # ECharts 컴포넌트 (Candlestick/Pie/Line)
│   │   ├── portfolio/        # 시장별 섹션·폼·테이블
│   │   └── ui/               # 공통 UI + Error Boundary
│   ├── hooks/                # TanStack Query / WebSocket / 장 상태 등
│   ├── services/             # 외부 API 호출 (DEV/PROD URL 분기)
│   ├── store/                # localStorage 어댑터
│   ├── utils/                # 수익률/포맷 등 순수 함수
│   ├── types/
│   └── constants/
└── docs/
    ├── features/             # 기능 명세
    ├── tech-point/           # 설계 의사결정
    └── trouble-shooting/     # 트러블슈팅 기록
```

---

## 라이선스 / 면책

- 본 프로젝트는 학습·포트폴리오 목적의 데모입니다.
- 표시되는 시세는 정보 제공용이며, 실제 투자 판단에 사용할 수 없습니다.
- 한국 주식은 KRX 데이터 정책상 실시간 체결가 대신 공공데이터포털 일별 데이터 또는 Mock 시뮬레이션을 사용합니다.
