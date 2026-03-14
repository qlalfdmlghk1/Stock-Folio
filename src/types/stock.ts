/** Finnhub /quote 응답 타입 */
export interface FinnhubQuote {
  /** 현재가 */
  c: number;
  /** 전일 대비 변동 */
  d: number;
  /** 전일 대비 변동률 (%) */
  dp: number;
  /** 고가 */
  h: number;
  /** 저가 */
  l: number;
  /** 시가 */
  o: number;
  /** 전일 종가 */
  pc: number;
  /** 타임스탬프 */
  t: number;
}

/** 포트폴리오에 저장되는 보유 종목 */
export interface PortfolioStock {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  market: 'US' | 'KR';
}

/** StockForm에서 사용하는 입력 데이터 (id 제외) */
export type StockFormData = Omit<PortfolioStock, 'id'>;

/** 한국 주식 Mock 시세 */
export interface KrxMockQuote {
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume: number;
}

/** 시장 구분 */
export type Market = 'US' | 'KR';

/** 화면에 표시되는 주식 시세 정보 */
export interface StockQuote {
  symbol: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
}

/** 파이차트 데이터 항목 — 종목별 포트폴리오 비중 */
export interface PieChartItem {
  name: string;
  symbol: string;
  value: number;
}

/** 라인차트 데이터 항목 — 기간별 손익 추이 */
export interface LineChartPoint {
  date: string;
  profitLoss: number;
  returnRate: number;
}

/** 캔들스틱 차트 OHLCV 데이터 */
export interface CandlestickData {
  date: string;
  open: number;
  close: number;
  low: number;
  high: number;
  volume: number;
}

/** Finnhub /stock/candle 응답 타입 */
export interface FinnhubCandle {
  /** 종가 배열 */
  c: number[];
  /** 고가 배열 */
  h: number[];
  /** 저가 배열 */
  l: number[];
  /** 시가 배열 */
  o: number[];
  /** 거래량 배열 */
  v: number[];
  /** 타임스탬프 배열 (UNIX seconds) */
  t: number[];
  /** 응답 상태 — 'ok' | 'no_data' */
  s: string;
}
