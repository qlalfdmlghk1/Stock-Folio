import { FINNHUB_API_KEY, FINNHUB_BASE_URL } from '../constants/api';
import type { FinnhubQuote, FinnhubCandle, StockQuote, CandlestickData } from '../types/stock';

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
