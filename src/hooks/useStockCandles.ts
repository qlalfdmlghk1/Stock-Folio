import { useQuery } from '@tanstack/react-query';
import { fetchAlphaVantageCandles } from '@/services/alphaVantage';
import { fetchQuote, generateUsMockCandles } from '@/services/finnhub';
import { generateKrxMockCandles } from '@/services/mockKrx';
import { DEFAULT_CANDLE_DAYS, CANDLE_STALE_TIME } from '@/constants/api';
import type { CandlestickData, Market } from '@/types/stock';

/** 캔들 데이터 + 데이터 소스 정보 */
export interface CandleResult {
  candles: CandlestickData[];
  /** true면 실제 API 데이터, false면 시뮬레이션 데이터 */
  isRealData: boolean;
}

/**
 * 종목의 일봉(OHLCV) 데이터를 조회하는 훅
 * [의사결정] 미국 주식 일봉: Alpha Vantage 1순위 → Mock fallback 2순위
 * [트러블슈팅] Finnhub /stock/candle 프리미엄 전용 전환(403) → Alpha Vantage로 대체
 * [의사결정] 한국 주식은 KRX API 불가 → Mock 시뮬레이션 유지
 * [의사결정] staleTime 5분 — 일봉 데이터는 장중에도 자주 변하지 않으므로 불필요한 재요청 방지
 */
export function useStockCandles(
  symbol: string,
  market: Market,
  days: number = DEFAULT_CANDLE_DAYS,
) {
  return useQuery<CandleResult>({
    queryKey: ['candles', symbol, market, days],
    queryFn: async () => {
      if (market === 'KR') {
        return { candles: generateKrxMockCandles(symbol, days), isRealData: false };
      }

      // 1순위: Alpha Vantage (실제 과거 일봉 데이터)
      try {
        const candles = await fetchAlphaVantageCandles(symbol, days);
        if (candles.length > 0) return { candles, isRealData: true };
      } catch {
        // [트러블슈팅] API 오류 시 mock fallback으로 진행
      }

      // 2순위: 현재가 기반 Mock 캔들 (Alpha Vantage 한도 초과/오류 시)
      const quote = await fetchQuote(symbol);
      return { candles: generateUsMockCandles(symbol, quote.currentPrice, days), isRealData: false };
    },
    staleTime: CANDLE_STALE_TIME,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    enabled: !!symbol,
  });
}
