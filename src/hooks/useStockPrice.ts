import { useQuery } from '@tanstack/react-query';
import { fetchQuote } from '@/services/finnhub';
import { POLLING_INTERVAL } from '@/constants/api';

/**
 * Finnhub REST API로 종목 현재가를 조회하는 훅
 * [의사결정] refetchInterval로 폴링 — 추후 WebSocket 연결 시 false로 전환 예정
 */
export function useStockPrice(symbol: string) {
  return useQuery({
    queryKey: ['quote', symbol],
    queryFn: () => fetchQuote(symbol),
    refetchInterval: POLLING_INTERVAL,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
    enabled: !!symbol,
  });
}
