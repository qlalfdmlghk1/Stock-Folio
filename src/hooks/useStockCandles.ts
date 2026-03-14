import { useQuery } from '@tanstack/react-query';
import { fetchCandles } from '../services/finnhub';
import { generateKrxMockCandles } from '../services/mockKrx';
import { DEFAULT_CANDLE_DAYS, CANDLE_STALE_TIME } from '../constants/api';
import type { CandlestickData, Market } from '../types/stock';

/**
 * 종목의 일봉(OHLCV) 데이터를 조회하는 훅
 * [의사결정] 미국 주식은 Finnhub /stock/candle API, 한국 주식은 Mock 시뮬레이션
 * [의사결정] staleTime 5분 — 일봉 데이터는 장중에도 자주 변하지 않으므로 불필요한 재요청 방지
 */
export function useStockCandles(
  symbol: string,
  market: Market,
  days: number = DEFAULT_CANDLE_DAYS,
) {
  return useQuery<CandlestickData[]>({
    queryKey: ['candles', symbol, market, days],
    queryFn: () => {
      if (market === 'KR') {
        // [의사결정] 한국 주식은 KRX API 불가 → Mock 캔들 데이터 생성
        return Promise.resolve(generateKrxMockCandles(symbol, days));
      }

      // 미국 주식: Finnhub candle API 호출
      const now = Math.floor(Date.now() / 1000);
      const from = now - days * 24 * 60 * 60;
      return fetchCandles(symbol, from, now);
    },
    staleTime: CANDLE_STALE_TIME,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    enabled: !!symbol,
  });
}
