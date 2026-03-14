# StockFolio — 실시간 주식 포트폴리오 트래커

미국 주식 실시간 시세 조회와 포트폴리오 수익률 추적을 제공하는 프론트엔드 애플리케이션입니다.

> 한국 주식은 KRX 데이터 정책 제한으로 KIS API 연동 구조로 설계하되, 데모 환경에서는 장중 시간 기반 Mock 시뮬레이션으로 운영합니다.

## 주요 기능

- **실시간 시세 조회** — Finnhub WebSocket으로 미국 주식 실시간 체결가 수신
- **WebSocket + REST 폴링 이중화** — WebSocket 단절 시 REST 폴링(5초 주기)으로 자동 전환
- **포트폴리오 관리** — 보유 종목 추가/수정/삭제 (localStorage 기반)
- **수익률 분석** — 종목별·전체 수익률, 평가손익 실시간 계산
- **차트 시각화** — 캔들스틱, 파이, 라인 차트 (ECharts)
- **장중/장외 자동 감지** — 시장 상태에 따른 UI 분기 처리

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | React 18 + TypeScript |
| 상태 관리 | TanStack Query v5 |
| 데이터 시각화 | Apache ECharts |
| 실시간 통신 | Finnhub WebSocket + REST 폴링 백업 |
| 스타일링 | Tailwind CSS |
| 빌드 도구 | Vite |
| 배포 | Vercel |

## 기술적 의사결정

### Finnhub API 선택 (vs Alpha Vantage)

Alpha Vantage 무료 플랜은 일 25회 호출 제한으로 5초 폴링 구현이 불가능합니다. Finnhub은 분당 60회 호출 + WebSocket 무제한 수신을 지원하여 실시간 데모 운영에 적합합니다.

### ECharts 선택 (vs Recharts, Chart.js)

캔들스틱 차트를 기본 지원하는 유일한 선택지이며, 금융권 실무에서 널리 사용되는 라이브러리입니다.

### WebSocket + 폴링 이중화 구조

WebSocket만 단독 사용 시 방화벽/프록시 환경에서 차단될 수 있습니다. REST 폴링을 백업으로 두어 어떤 네트워크 환경에서도 시세 갱신이 끊기지 않도록 설계했습니다.

```
WebSocket 연결 실패 또는 단절
        ↓
자동으로 REST 폴링 (5초 주기)으로 전환
        ↓
WebSocket 재연결 성공 시 다시 WebSocket으로 전환
```

## 시작하기

### 사전 요구사항

- Node.js 18+
- [Finnhub API Key](https://finnhub.io/) (무료)

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일에 VITE_FINNHUB_API_KEY 입력

# 개발 서버 실행
npm run dev
```

### 스크립트

```bash
npm run dev       # 개발 서버
npm run build     # 프로덕션 빌드
npm run preview   # 빌드 결과 미리보기
npm run lint      # ESLint 검사
```

## 프로젝트 구조

```
src/
├── components/
│   ├── charts/          # ECharts 차트 (캔들스틱, 파이, 라인)
│   ├── portfolio/       # 포트폴리오 테이블, 종목 추가 폼
│   └── ui/              # 공통 UI (에러 바운더리, 상태 배너)
├── hooks/               # 커스텀 훅 (시세 조회, WebSocket, 장 상태)
├── services/            # API 호출, Mock 데이터 생성
├── store/               # localStorage 상태 관리
├── types/               # 공통 타입 정의
├── utils/               # 수익률 계산, 포맷 유틸
└── constants/           # API 엔드포인트, 설정값
```

## 라이선스

MIT
