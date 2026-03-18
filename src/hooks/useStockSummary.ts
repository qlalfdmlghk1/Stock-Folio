import { useQuery } from '@tanstack/react-query';
import { SUMMARY_STALE_TIME } from '@/constants/api';
import { fetchStockSummary } from '@/services/gemini';
import type { Market } from '@/types/stock';

/**
 * 종목 AI 요약 훅
 * [의사결정] TanStack Query로 캐싱 — 같은 종목 재선택 시 API 재호출 방지
 * [의사결정] staleTime 10분 — 동향 요약은 자주 변하지 않으므로 캐시 유지
 */
export function useStockSummary(
  symbol: string,
  name: string,
  market: Market
) {
  return useQuery({
    queryKey: ['stockSummary', symbol, market],
    queryFn: () => fetchStockSummary(symbol, name, market),
    enabled: !!symbol && !!name,
    staleTime: SUMMARY_STALE_TIME,
    retry: 1,
    retryDelay: 3000,
  });
}
