/**
 * [의사결정] API 키 보안 아키텍처
 * - 프로덕션: Vercel Serverless Function 프록시 (api/) → API 키 서버에서만 관리
 * - 개발 환경: VITE_ 접두사 키로 직접 호출 (로컬에서만 노출, 프로덕션 번들에 미포함)
 * - WebSocket: 클라이언트 직접 연결 필수 → VITE_FINNHUB_API_KEY만 클라이언트 유지
 */

// WebSocket은 클라이언트에서 직접 연결해야 하므로 VITE_ 키 필수 유지
export const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY as string;
export const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
export const FINNHUB_WS_URL = `wss://ws.finnhub.io?token=${FINNHUB_API_KEY}`;

// 개발 환경에서만 직접 호출 시 사용 (프로덕션은 서버리스 프록시가 키 관리)
export const ALPHA_VANTAGE_API_KEY = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY as string;
export const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';

/** REST 폴링 주기 (ms) — WebSocket 단절 시 백업용 */
export const POLLING_INTERVAL = 5000;

/** 캔들 데이터 기본 조회 기간 (일) */
export const DEFAULT_CANDLE_DAYS = 90;

/** 캔들 데이터 캐시 유지 시간 (ms) — 일봉은 자주 변하지 않으므로 5분 */
export const CANDLE_STALE_TIME = 5 * 60 * 1000;

// Gemini API — 종목 요약 기능용
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/** 종목 요약 캐시 유지 시간 (ms) — 동향 요약은 10분간 유효 */
export const SUMMARY_STALE_TIME = 10 * 60 * 1000;

// 공공데이터포털 — 한국 주식 시세 정보
export const KRX_API_KEY = import.meta.env.VITE_KRX_API_KEY as string;
export const KRX_BASE_URL = 'https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService';

/** 한국 주식 시세 캐시 유지 시간 (ms) — 일별 데이터이므로 10분 */
export const KRX_STALE_TIME = 10 * 60 * 1000;
