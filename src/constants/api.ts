export const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY as string;
export const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
export const FINNHUB_WS_URL = `wss://ws.finnhub.io?token=${FINNHUB_API_KEY}`;

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
