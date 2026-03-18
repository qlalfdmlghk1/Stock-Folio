import { ALPHA_VANTAGE_API_KEY, ALPHA_VANTAGE_BASE_URL } from '@/constants/api';
import type { CandlestickData } from '@/types/stock';

/**
 * Alpha Vantage TIME_SERIES_DAILY 응답 타입
 * [의사결정] Finnhub /stock/candle 프리미엄 전용 전환 → 과거 일봉 데이터는 Alpha Vantage로 대체
 * [의사결정] 실시간 시세는 Finnhub(분당 60회), 과거 일봉은 Alpha Vantage(일 25회) — 용도 분리
 */
interface AlphaVantageDailyResponse {
  'Time Series (Daily)': Record<string, {
    '1. open': string;
    '2. high': string;
    '3. low': string;
    '4. close': string;
    '5. volume': string;
  }>;
  Note?: string;       // API 한도 초과 시 메시지
  Information?: string; // API 키 오류 등
}

/**
 * Alpha Vantage TIME_SERIES_DAILY API로 일봉 데이터를 조회한다.
 * [의사결정] outputsize=compact — 최근 100일 데이터 (full은 20년치라 불필요하게 큼)
 * [트러블슈팅] 일 25회 한도 초과 시 Note 필드 반환 → 빈 배열로 처리 (mock fallback 유도)
 */
export async function fetchAlphaVantageCandles(
  symbol: string,
  days: number,
): Promise<CandlestickData[]> {
  const url = `${ALPHA_VANTAGE_BASE_URL}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${ALPHA_VANTAGE_API_KEY}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) {
      throw new Error(`Alpha Vantage API 오류: ${res.status}`);
    }

    const data: AlphaVantageDailyResponse = await res.json();

    // [트러블슈팅] 한도 초과 또는 키 오류 시 Note/Information 필드가 포함됨
    if (data.Note || data.Information) {
      return [];
    }

    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) return [];

    const candles: CandlestickData[] = Object.entries(timeSeries)
      .map(([date, values]) => ({
        date,
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseInt(values['5. volume'], 10),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)); // 날짜 오름차순 정렬

    // 요청한 일수만큼만 반환
    return candles.slice(-days);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`"${symbol}" Alpha Vantage 일봉 조회 응답 시간 초과 (10초)`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
