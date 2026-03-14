import type { KrxMockQuote, CandlestickData } from '../types/stock';

/**
 * 한국 주요 종목 기준가 데이터
 * [의사결정] KRX 데이터 정책상 실시간 API 사용 불가 → 장중 시간 기반 Realistic Mock
 */
const KR_BASE_STOCKS: Record<string, { name: string; basePrice: number }> = {
  '005930': { name: '삼성전자', basePrice: 72000 },
  '000660': { name: 'SK하이닉스', basePrice: 178000 },
  '373220': { name: 'LG에너지솔루션', basePrice: 380000 },
  '005380': { name: '현대자동차', basePrice: 245000 },
  '006400': { name: '삼성SDI', basePrice: 420000 },
  '035420': { name: 'NAVER', basePrice: 215000 },
  '035720': { name: '카카오', basePrice: 52000 },
  '051910': { name: 'LG화학', basePrice: 385000 },
  '068270': { name: '셀트리온', basePrice: 185000 },
  '105560': { name: 'KB금융', basePrice: 78000 },
};

/** 한국 장중 여부 (09:00 ~ 15:30 KST) */
export function isKrxMarketOpen(): boolean {
  const now = new Date();
  // [의사결정] KST = UTC+9, toLocaleString으로 한국 시간 기준 판단
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const hours = kst.getHours();
  const minutes = kst.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // 09:00 (540분) ~ 15:30 (930분)
  return totalMinutes >= 540 && totalMinutes < 930;
}

/**
 * 기준가 대비 ±3% 범위에서 현실적 변동가를 생성한다.
 * [의사결정] 장중에만 시뮬레이션 활성화, 장외 시간엔 기준가 그대로 반환
 */
function simulatePrice(basePrice: number): number {
  if (!isKrxMarketOpen()) return basePrice;

  // ±3% 범위 랜덤 변동
  const fluctuation = (Math.random() - 0.5) * 0.06;
  const simulated = basePrice * (1 + fluctuation);

  // 한국 주식 호가 단위에 맞게 반올림 (1원 단위)
  return Math.round(simulated);
}

/** 특정 한국 종목의 Mock 시세를 생성한다 */
export function fetchKrxMockQuote(symbol: string): KrxMockQuote | null {
  const stock = KR_BASE_STOCKS[symbol];
  if (!stock) return null;

  const currentPrice = simulatePrice(stock.basePrice);
  const open = simulatePrice(stock.basePrice);
  const high = Math.max(currentPrice, open, simulatePrice(stock.basePrice));
  const low = Math.min(currentPrice, open, simulatePrice(stock.basePrice));
  const change = currentPrice - stock.basePrice;
  const changePercent = (change / stock.basePrice) * 100;

  return {
    symbol,
    name: stock.name,
    currentPrice,
    change,
    changePercent,
    high,
    low,
    open,
    previousClose: stock.basePrice,
    volume: Math.floor(Math.random() * 10_000_000),
  };
}

/** 등록된 한국 종목 심볼 목록 반환 */
export function getAvailableKrxSymbols(): Array<{ symbol: string; name: string }> {
  return Object.entries(KR_BASE_STOCKS).map(([symbol, { name }]) => ({
    symbol,
    name,
  }));
}

/** 심볼로 한국 종목명 조회 */
export function getKrxStockName(symbol: string): string | null {
  return KR_BASE_STOCKS[symbol]?.name ?? null;
}

/**
 * 한국 종목의 과거 일봉 Mock 데이터를 생성한다.
 * [의사결정] 실제 KRX 과거 데이터 API 없음 → 기준가 기반 Realistic 시뮬레이션
 * [의사결정] 시드 기반 랜덤 — 같은 symbol+days 조합이면 동일한 결과 반환 (차트 안정성)
 */
export function generateKrxMockCandles(symbol: string, days: number): CandlestickData[] {
  const stock = KR_BASE_STOCKS[symbol];
  if (!stock) return [];

  const candles: CandlestickData[] = [];
  let prevClose = stock.basePrice;

  // 시드 기반 의사 난수 — symbol 해시로 동일 입력에 동일 출력 보장
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) {
    seed = ((seed << 5) - seed + symbol.charCodeAt(i)) | 0;
  }
  function seededRandom(): number {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed & 0x7fffffff) / 2147483647;
  }

  const today = new Date();

  for (let i = days; i >= 1; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // 주말 건너뛰기
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    // ±2% 일간 변동
    const changeRate = (seededRandom() - 0.5) * 0.04;
    const close = Math.round(prevClose * (1 + changeRate));
    const open = Math.round(prevClose * (1 + (seededRandom() - 0.5) * 0.02));
    const high = Math.max(open, close) + Math.round(seededRandom() * prevClose * 0.01);
    const low = Math.min(open, close) - Math.round(seededRandom() * prevClose * 0.01);
    const volume = Math.floor(seededRandom() * 10_000_000) + 500_000;

    candles.push({
      date: date.toISOString().split('T')[0],
      open,
      close,
      high,
      low: Math.max(low, 1),
      volume,
    });

    prevClose = close;
  }

  return candles;
}
