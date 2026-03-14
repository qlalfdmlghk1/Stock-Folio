export const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY as string;
export const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
export const FINNHUB_WS_URL = `wss://ws.finnhub.io?token=${FINNHUB_API_KEY}`;

/** REST 폴링 주기 (ms) — WebSocket 단절 시 백업용 */
export const POLLING_INTERVAL = 5000;

/** 캔들 데이터 기본 조회 기간 (일) */
export const DEFAULT_CANDLE_DAYS = 90;

/** 캔들 데이터 캐시 유지 시간 (ms) — 일봉은 자주 변하지 않으므로 5분 */
export const CANDLE_STALE_TIME = 5 * 60 * 1000;
