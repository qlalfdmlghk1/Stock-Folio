import { useQuery } from '@tanstack/react-query';
import { fetchKrxQuote } from '@/services/krxApi';
import { KRX_STALE_TIME } from '@/constants/api';

/**
 * 공공데이터포털 API로 한국 종목 시세를 조회하는 훅
 * [의사결정] 일별 데이터이므로 staleTime 10분 — 장중에도 종가 데이터는 변하지 않음
 * [의사결정] API 실패 시 내부적으로 Mock fallback 처리 — 컴포넌트는 데이터 소스를 신경 쓰지 않음
 */
export function useKrxStockPrice(symbol: string) {
  return useQuery({
    queryKey: ['krx-quote', symbol],
    queryFn: () => fetchKrxQuote(symbol),
    staleTime: KRX_STALE_TIME,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    enabled: !!symbol,
  });
}
