import type { KrxApiResponse, KrxApiItem, CandlestickData } from '@/types/stock';
import type { KrxMockQuote } from '@/types/stock';
import { KRX_API_KEY, KRX_BASE_URL } from '@/constants/api';
import { fetchKrxMockQuote, generateKrxMockCandles, getAvailableKrxSymbols } from '@/services/mockKrx';

/**
 * 공공데이터포털 금융위원회_주식시세정보 API 호출
 * [의사결정] 한국 주식 실시간 API 불가 → 공공데이터포털 일별 종가 데이터로 대체
 * [의사결정] API 실패 시 기존 Mock 데이터로 자동 전환 — UX 연속성 보장
 */

/** 종목 검색 결과 항목 */
export interface KrxSearchResult {
  symbol: string;
  name: string;
  market: string;
  closePrice: number;
}

/**
 * 종목명으로 KRX 종목을 검색한다.
 * [의사결정] 디바운스된 검색어로 호출 — API 호출 최소화
 */
export async function searchKrxStocks(keyword: string): Promise<KrxSearchResult[]> {
  if (!keyword.trim() || keyword.trim().length < 1) return [];

  // 개발 환경에서만 키 존재 여부 체크 (프로덕션은 서버리스 프록시가 키 관리)
  if (import.meta.env.DEV && (!KRX_API_KEY || KRX_API_KEY === '여기에_공공데이터포털_Decoding_인증키_입력')) {
    return searchMockStocks(keyword);
  }

  try {
    const baseParams: Record<string, string> = {
      numOfRows: '10',
      pageNo: '1',
      resultType: 'json',
      likeItmsNm: keyword.trim(),
    };

    // [의사결정] 프로덕션은 서버리스 프록시로 API 키 은닉
    const url = import.meta.env.DEV
      ? `${KRX_BASE_URL}/getStockPriceInfo?${new URLSearchParams({ serviceKey: KRX_API_KEY, ...baseParams })}`
      : `/api/krx?${new URLSearchParams(baseParams)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5_000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data: KrxApiResponse = await response.json();
    const items = data.response?.body?.items?.item;

    if (!items || items.length === 0) return [];

    // 중복 종목코드 제거 (날짜별 데이터가 여러 개 올 수 있음)
    const seen = new Set<string>();
    return items
      .filter((item) => {
        if (seen.has(item.srtnCd)) return false;
        seen.add(item.srtnCd);
        return true;
      })
      .map((item) => ({
        symbol: item.srtnCd,
        name: item.itmsNm,
        market: item.mrktCtg,
        closePrice: Number(item.clpr),
      }));
  } catch {
    console.warn(`[KRX API] 종목 검색 실패 — Mock 데이터로 대체`);
    return searchMockStocks(keyword);
  }
}

/** Mock 데이터에서 종목명 검색 (API 키 없을 때 fallback) */
function searchMockStocks(keyword: string): KrxSearchResult[] {
  const stocks = getAvailableKrxSymbols();
  return stocks
    .filter((s) => s.name.includes(keyword))
    .map((s) => ({ symbol: s.symbol, name: s.name, market: 'KOSPI', closePrice: 0 }));
}

/** YYYYMMDD 형식 날짜 문자열 생성 */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** 최근 거래일 추정 (주말 제외) */
function getLastTradingDate(): string {
  const now = new Date();
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const day = kst.getDay();

  // 토요일(6) → 금요일, 일요일(0) → 금요일
  if (day === 0) kst.setDate(kst.getDate() - 2);
  else if (day === 6) kst.setDate(kst.getDate() - 1);

  return formatDate(kst);
}

/** 시세 조회 결과 — 데이터 소스(실제/Mock) 구분 포함 */
export interface KrxQuoteResult {
  quote: KrxMockQuote | null;
  /** true면 공공데이터포털 실제 데이터, false면 Mock 시뮬레이션 */
  isRealData: boolean;
}

/**
 * 공공데이터포털에서 특정 종목의 최신 시세를 조회한다.
 * [의사결정] 실패 시 Mock fallback — 공공 API 장애/키 미활성화 시에도 앱 정상 동작
 */
export async function fetchKrxQuote(symbol: string): Promise<KrxQuoteResult> {
  if (import.meta.env.DEV && (!KRX_API_KEY || KRX_API_KEY === '여기에_공공데이터포털_Decoding_인증키_입력')) {
    return { quote: fetchKrxMockQuote(symbol), isRealData: false };
  }

  try {
    const baseParams: Record<string, string> = {
      numOfRows: '1',
      pageNo: '1',
      resultType: 'json',
      likeSrtnCd: symbol,
      basDt: getLastTradingDate(),
    };

    const url = import.meta.env.DEV
      ? `${KRX_BASE_URL}/getStockPriceInfo?${new URLSearchParams({ serviceKey: KRX_API_KEY, ...baseParams })}`
      : `/api/krx?${new URLSearchParams(baseParams)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data: KrxApiResponse = await response.json();
    const items = data.response?.body?.items?.item;

    if (!items || items.length === 0) {
      // [트러블슈팅] 해당 날짜에 데이터 없으면 (공휴일 등) 이전 거래일 재시도
      return await fetchKrxQuoteWithRetry(symbol, 1);
    }

    return { quote: mapApiItemToQuote(items[0]), isRealData: true };
  } catch {
    // [트러블슈팅] API 오류 시 Mock fallback으로 앱 중단 방지
    console.warn(`[KRX API] ${symbol} 조회 실패 — Mock 데이터로 대체`);
    return { quote: fetchKrxMockQuote(symbol), isRealData: false };
  }
}

/**
 * 최근 거래일을 찾을 때까지 최대 5일 이전까지 재시도
 * [의사결정] 공휴일·연휴 시 데이터 미존재 → 이전 거래일로 자동 탐색
 */
async function fetchKrxQuoteWithRetry(symbol: string, daysBack: number): Promise<KrxQuoteResult> {
  if (daysBack > 5) return { quote: fetchKrxMockQuote(symbol), isRealData: false };

  try {
    const date = new Date();
    const kst = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    kst.setDate(kst.getDate() - daysBack);

    // 주말 건너뛰기
    const day = kst.getDay();
    if (day === 0) kst.setDate(kst.getDate() - 2);
    else if (day === 6) kst.setDate(kst.getDate() - 1);

    const baseParams: Record<string, string> = {
      numOfRows: '1',
      pageNo: '1',
      resultType: 'json',
      likeSrtnCd: symbol,
      basDt: formatDate(kst),
    };

    const retryUrl = import.meta.env.DEV
      ? `${KRX_BASE_URL}/getStockPriceInfo?${new URLSearchParams({ serviceKey: KRX_API_KEY, ...baseParams })}`
      : `/api/krx?${new URLSearchParams(baseParams)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(retryUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data: KrxApiResponse = await response.json();
    const items = data.response?.body?.items?.item;

    if (!items || items.length === 0) {
      return await fetchKrxQuoteWithRetry(symbol, daysBack + 1);
    }

    return { quote: mapApiItemToQuote(items[0]), isRealData: true };
  } catch {
    return { quote: fetchKrxMockQuote(symbol), isRealData: false };
  }
}

/**
 * 공공데이터포털에서 종목의 과거 일봉 데이터를 조회한다.
 * [의사결정] 캔들스틱 차트용 OHLCV 데이터 — 실제 과거 시세로 차트 신뢰도 향상
 * [의사결정] 실패 시 Mock 캔들로 fallback
 */
export async function fetchKrxCandles(symbol: string, days: number): Promise<{ candles: CandlestickData[]; isRealData: boolean }> {
  if (import.meta.env.DEV && (!KRX_API_KEY || KRX_API_KEY === '여기에_공공데이터포털_Decoding_인증키_입력')) {
    return { candles: generateKrxMockCandles(symbol, days), isRealData: false };
  }

  try {
    // 시작일 계산 (주말·공휴일 감안하여 요청 기간을 약간 넉넉하게)
    const endDate = new Date();
    const kstEnd = new Date(endDate.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const startDate = new Date(kstEnd);
    startDate.setDate(startDate.getDate() - Math.ceil(days * 1.5));

    const baseParams: Record<string, string> = {
      numOfRows: String(days),
      pageNo: '1',
      resultType: 'json',
      likeSrtnCd: symbol,
      beginBasDt: formatDate(startDate),
      endBasDt: formatDate(kstEnd),
    };

    const candleUrl = import.meta.env.DEV
      ? `${KRX_BASE_URL}/getStockPriceInfo?${new URLSearchParams({ serviceKey: KRX_API_KEY, ...baseParams })}`
      : `/api/krx?${new URLSearchParams(baseParams)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    const response = await fetch(candleUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data: KrxApiResponse = await response.json();
    const items = data.response?.body?.items?.item;

    if (!items || items.length === 0) {
      return { candles: generateKrxMockCandles(symbol, days), isRealData: false };
    }

    // API는 최신일 먼저 반환 → 오래된 날짜순으로 정렬
    const sorted = [...items].sort((a, b) => a.basDt.localeCompare(b.basDt));

    const candles: CandlestickData[] = sorted.map((item) => ({
      date: `${item.basDt.slice(0, 4)}-${item.basDt.slice(4, 6)}-${item.basDt.slice(6, 8)}`,
      open: Number(item.mkp),
      close: Number(item.clpr),
      high: Number(item.hipr),
      low: Number(item.lopr),
      volume: Number(item.trqu),
    }));

    return { candles, isRealData: true };
  } catch {
    console.warn(`[KRX API] ${symbol} 캔들 조회 실패 — Mock 데이터로 대체`);
    return { candles: generateKrxMockCandles(symbol, days), isRealData: false };
  }
}

/** API 응답 항목을 KrxMockQuote 형식으로 변환 */
function mapApiItemToQuote(item: KrxApiItem): KrxMockQuote {
  const currentPrice = Number(item.clpr);
  const change = Number(item.vs);
  const previousClose = currentPrice - change;

  return {
    symbol: item.srtnCd,
    name: item.itmsNm,
    currentPrice,
    change,
    changePercent: Number(item.fltRt),
    high: Number(item.hipr),
    low: Number(item.lopr),
    open: Number(item.mkp),
    previousClose,
    volume: Number(item.trqu),
  };
}
