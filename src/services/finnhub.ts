import { FINNHUB_API_KEY, FINNHUB_BASE_URL } from '@/constants/api';
import type { FinnhubQuote, FinnhubCandle, StockQuote, CandlestickData } from '@/types/stock';

/**
 * 미국 종목의 Mock 일봉 데이터를 현재가 기반으로 생성한다.
 * [트러블슈팅] Finnhub 무료 플랜에서 /stock/candle 엔드포인트 403 → 현재가 기반 Mock으로 대체
 * [의사결정] 시드 기반 의사 난수 — 동일 symbol+days 조합이면 동일 결과 (차트 안정성)
 */
export function generateUsMockCandles(
  symbol: string,
  currentPrice: number,
  days: number,
): CandlestickData[] {
  const candles: CandlestickData[] = [];

  // 시드 기반 의사 난수 — symbol 해시로 동일 입력에 동일 출력 보장
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) {
    seed = ((seed << 5) - seed + symbol.charCodeAt(i)) | 0;
  }
  function seededRandom(): number {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed & 0x7fffffff) / 2147483647;
  }

  // 현재가에서 역산하여 과거 가격 시뮬레이션
  let prevClose = currentPrice;
  const today = new Date();

  // 과거 → 현재 순으로 생성하기 위해 먼저 역방향 가격 시뮬레이션
  const pricePoints: number[] = [currentPrice];
  for (let i = 1; i <= days; i++) {
    const changeRate = (seededRandom() - 0.5) * 0.04; // ±2% 일간 변동
    prevClose = prevClose / (1 + changeRate);
    pricePoints.unshift(prevClose);
  }

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - (days - i));

    // 주말 건너뛰기
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const close = pricePoints[i + 1];
    const open = pricePoints[i] * (1 + (seededRandom() - 0.5) * 0.02);
    const high = Math.max(open, close) * (1 + seededRandom() * 0.01);
    const low = Math.min(open, close) * (1 - seededRandom() * 0.01);
    const volume = Math.floor(seededRandom() * 50_000_000) + 5_000_000;

    candles.push({
      date: date.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100,
      close: Math.round(close * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(Math.max(low, 0.01) * 100) / 100,
      volume,
    });
  }

  return candles;
}

/**
 * Finnhub REST API로 종목 현재가를 조회한다.
 * [의사결정] WebSocket 단절 시 폴링 백업으로도 사용되므로 독립 함수로 분리
 */
export async function fetchQuote(symbol: string): Promise<StockQuote> {
  const url = `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) {
      throw new Error(`Finnhub API 오류: ${res.status}`);
    }

    const data: FinnhubQuote = await res.json();

    // [트러블슈팅] c가 0이면 잘못된 심볼이거나 데이터 없음
    if (data.c === 0) {
      throw new Error(`"${symbol}" 시세 데이터를 찾을 수 없습니다.`);
    }

    return {
      symbol,
      currentPrice: data.c,
      change: data.d,
      changePercent: data.dp,
      high: data.h,
      low: data.l,
      open: data.o,
      previousClose: data.pc,
      timestamp: data.t,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Finnhub REST API로 종목의 일봉(OHLCV) 데이터를 조회한다.
 * [의사결정] /stock/candle 엔드포인트 사용 — 무료 플랜에서 일봉 데이터 제공
 * [의사결정] resolution 'D'(일봉) 고정 — 캔들스틱 차트 + 라인차트 손익 역산에 모두 사용
 */
export async function fetchCandles(
  symbol: string,
  from: number,
  to: number,
): Promise<CandlestickData[]> {
  const url = `${FINNHUB_BASE_URL}/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) {
      throw new Error(`Finnhub Candle API 오류: ${res.status}`);
    }

    const data: FinnhubCandle = await res.json();

    // [트러블슈팅] s가 'no_data'이면 해당 기간 데이터 없음 (심볼 오류 또는 상장 전)
    if (data.s !== 'ok' || !data.t) {
      return [];
    }

    return data.t.map((timestamp, i) => ({
      date: new Date(timestamp * 1000).toISOString().split('T')[0],
      open: data.o[i],
      close: data.c[i],
      high: data.h[i],
      low: data.l[i],
      volume: data.v[i],
    }));
  } finally {
    clearTimeout(timeout);
  }
}
