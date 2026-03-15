import { useMemo } from 'react';
import { useStockPrice } from './useStockPrice';

/**
 * 여러 종목의 현재가를 동시에 조회하는 훅
 * [의사결정] 각 심볼마다 독립적인 useStockPrice 호출 — TanStack Query가 캐시 관리
 * 최대 10개로 제한하여 Finnhub 분당 60회 API 제한 내에서 운영
 */
export function useMultipleStockPrices(symbols: string[]) {
  const limited = symbols.slice(0, 10);

  const q0 = useStockPrice(limited[0] ?? '');
  const q1 = useStockPrice(limited[1] ?? '');
  const q2 = useStockPrice(limited[2] ?? '');
  const q3 = useStockPrice(limited[3] ?? '');
  const q4 = useStockPrice(limited[4] ?? '');
  const q5 = useStockPrice(limited[5] ?? '');
  const q6 = useStockPrice(limited[6] ?? '');
  const q7 = useStockPrice(limited[7] ?? '');
  const q8 = useStockPrice(limited[8] ?? '');
  const q9 = useStockPrice(limited[9] ?? '');

  const queries = [q0, q1, q2, q3, q4, q5, q6, q7, q8, q9];

  return useMemo(
    () =>
      limited.map((symbol, i) => ({
        symbol,
        price: queries[i].data?.currentPrice,
        isLoading: queries[i].isLoading,
        isError: queries[i].isError,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [limited.join(','), ...queries.map((q) => q.data?.currentPrice)],
  );
}
