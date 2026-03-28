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

/**
 * 공공데이터포털 금융위원회_주식시세정보 API 응답 항목
 * [의사결정] KRX 실시간 API 불가 → 공공데이터포털 일별 시세 데이터로 대체
 */
export interface KrxApiItem {
  /** 기준일자 (YYYYMMDD) */
  basDt: string;
  /** 단축코드 (종목코드, 예: 005930) */
  srtnCd: string;
  /** ISIN 코드 */
  isinCd: string;
  /** 종목명 */
  itmsNm: string;
  /** 시장구분 (KOSPI / KOSDAQ) */
  mrktCtg: string;
  /** 종가 */
  clpr: string;
  /** 대비 (전일 대비 변동) */
  vs: string;
  /** 등락률 */
  fltRt: string;
  /** 시가 */
  mkp: string;
  /** 고가 */
  hipr: string;
  /** 저가 */
  lopr: string;
  /** 거래량 */
  trqu: string;
  /** 거래대금 */
  trPrc: string;
  /** 상장주식수 */
  lstgStCnt: string;
  /** 시가총액 */
  mrktTotAmt: string;
}

/** 공공데이터포털 API 전체 응답 구조 */
export interface KrxApiResponse {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      numOfRows: number;
      pageNo: number;
      totalCount: number;
      items: {
        item: KrxApiItem[];
      };
    };
  };
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
