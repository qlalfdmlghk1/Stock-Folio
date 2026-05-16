# VITE_ 접두사 API 키 브라우저 노출 — Vercel Serverless Proxy 도입

> 프론트엔드 전용 구조에서 VITE_ 접두사 환경변수가 프로덕션 번들에 포함되어 API 키가 브라우저 개발자 도구에서 그대로 노출되는 문제 → Vercel Serverless Function 프록시로 키를 서버 측으로 이동하여 해결

## 증상

- **발생 시점**: Vercel 배포 준비 단계에서 IDE 경고 확인
- **증상**: IDE에서 `This key, which is prefixed with VITE_ and includes the term KEY, might expose sensitive information to the browser` 경고 발생. 실제로 배포된 사이트에서 브라우저 개발자 도구(F12) → Network 탭을 열면 API 키가 요청 URL에 평문으로 노출됨
- **에러 메시지**:
```
GET https://finnhub.io/api/v1/quote?symbol=AAPL&token=d6odf29r01qu09...
GET https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=AIzaSy...
```

## 원인 분석

### 시도한 접근

1. `.env` 파일을 `.gitignore`에 추가하여 소스코드 유출 방지 → **불충분**. Vite는 빌드 시 `VITE_` 접두사 환경변수를 번들에 인라인하므로, 소스 저장소와 무관하게 배포된 JS 파일에 키가 포함됨

### 실제 원인

Vite의 설계 원칙에 의한 구조적 문제:

- `VITE_` 접두사가 붙은 환경변수는 `import.meta.env.VITE_*`로 클라이언트 코드에서 접근 가능
- 프로덕션 빌드 시 Vite가 이 값들을 **문자열 리터럴로 치환**하여 번들에 삽입
- 백엔드 없는 프론트엔드 전용 구조에서는 API 키를 서버에 숨길 방법이 없음

| API | 노출 위험도 | 이유 |
|-----|------------|------|
| Finnhub | 낮음 | 무료 플랜, 분당 60회 제한 |
| Alpha Vantage | 낮음 | 무료 플랜, 일 25회 제한 |
| KRX 공공데이터 | 낮음 | 공공 무료 API |
| **Gemini** | **높음** | **Google AI API — 사용량에 따라 과금 가능** |

특히 Gemini API 키가 노출될 경우, 제3자가 키를 복사하여 대량 호출하면 과금이 발생할 수 있는 보안 리스크.

## 해결

### 해결 방법

**Vercel Serverless Function을 프록시로 도입** — 브라우저는 자체 서버(`/api/*`)에만 요청하고, 서버가 API 키를 붙여서 외부 API를 대신 호출하는 구조로 변경.

```
[변경 전 — 키 노출]
브라우저  ─── API키 포함 ───→  외부 API
            (개발자 도구에서 키 확인 가능)

[변경 후 — 키 은닉]
브라우저  ─── 키 없음 ───→  Vercel Serverless  ─── 키 포함 ───→  외부 API
                            (process.env에서 키 주입)
```

**환경별 분기 전략** — `import.meta.env.DEV`를 활용하여 개발/프로덕션 동작 분리:

```typescript
// src/services/finnhub.ts — 환경별 URL 분기
const url = import.meta.env.DEV
  ? `${FINNHUB_BASE_URL}/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`  // 개발: 직접 호출
  : `/api/finnhub?path=quote&symbol=${symbol}`;                            // 프로덕션: 프록시
```

**서버리스 프록시 함수** — API 키를 서버 환경변수(`process.env`)에서 주입:

```typescript
// api/finnhub.ts — Vercel Edge Runtime
export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');

  const params = new URLSearchParams(searchParams);
  params.delete('path');
  params.set('token', process.env.FINNHUB_API_KEY);  // 서버에서 키 주입

  const apiUrl = `https://finnhub.io/api/v1/${path}?${params}`;
  const response = await fetch(apiUrl);
  const data = await response.json();

  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

**WebSocket 예외 처리**:
- WebSocket은 브라우저에서 직접 연결해야 하므로 프록시 불가
- `VITE_FINNHUB_API_KEY`만 클라이언트에 유지 (Finnhub 무료 플랜 분당 60회 제한으로 남용 위험 낮음)

**Vercel 환경변수 설정**:

| 변수명 | 위치 | 용도 |
|--------|------|------|
| `VITE_FINNHUB_API_KEY` | 클라이언트 (번들 포함) | WebSocket 연결 전용 |
| `FINNHUB_API_KEY` | 서버 전용 | REST API 프록시 |
| `ALPHA_VANTAGE_API_KEY` | 서버 전용 | REST API 프록시 |
| `GEMINI_API_KEY` | 서버 전용 | REST API 프록시 |
| `KRX_API_KEY` | 서버 전용 | REST API 프록시 |

### 관련 파일

| 파일 | 변경 내용 |
|------|-----------|
| `api/finnhub.ts` | Finnhub REST API 프록시 (신규) |
| `api/alpha-vantage.ts` | Alpha Vantage API 프록시 (신규) |
| `api/gemini.ts` | Gemini API 프록시 (신규) |
| `api/krx.ts` | 공공데이터포털 KRX API 프록시 (신규) |
| `src/services/finnhub.ts` | DEV/PROD URL 분기 적용 |
| `src/services/alphaVantage.ts` | DEV/PROD URL 분기 적용 |
| `src/services/gemini.ts` | DEV/PROD URL 분기 + 키 체크 분기 |
| `src/services/krxApi.ts` | 4개 함수 DEV/PROD URL 분기 + 키 체크 분기 |
| `src/constants/api.ts` | API 키 보안 아키텍처 주석 추가 |
| `tsconfig.api.json` | api/ 디렉토리 TypeScript 설정 (신규) |

## 배운 점

- **프론트엔드 전용 ≠ 보안 불가**: 백엔드가 없어도 Vercel Serverless Function 같은 경량 서버리스를 활용하면 API 키를 안전하게 관리할 수 있다. "프론트엔드 전용"이라는 제약 안에서도 보안 설계가 가능하다.
- **Vite의 환경변수 동작 이해**: `VITE_` 접두사는 클라이언트 번들에 인라인되는 설계이므로, 민감 정보에는 사용하면 안 된다. `import.meta.env.DEV` 분기를 활용하면 프로덕션 빌드 시 Vite가 DEV 분기를 tree-shake하여 키가 번들에 포함되지 않는다.

## 면접 포인트

- **보안 아키텍처 설계**: 프론트엔드 전용 프로젝트에서도 API 키 보안을 고려하여 Serverless Proxy를 도입한 점 — 금융권에서 특히 중시하는 보안 의식
- **환경별 분기 전략**: `import.meta.env.DEV` + Vite tree-shaking을 활용하여 개발 편의성(직접 호출)과 프로덕션 보안(프록시)을 동시에 만족시킨 설계
- **제약 조건 내 최적 해결**: WebSocket은 프록시 불가라는 기술적 한계를 인지하고, REST만 프록시하되 WebSocket 키는 무료 플랜 제한(분당 60회)으로 남용 위험이 낮다는 근거를 기반으로 수용한 엔지니어링 판단
