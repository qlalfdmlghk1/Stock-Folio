import { useMemo } from 'react';
import { useStockPrice } from './useStockPrice';

/**
 * 여러 종목의 현재가를 동시에 조회하는 훅
 * [의사결정] 각 심볼마다 독립적인 useStockPrice 호출 — TanStack Query가 캐시 관리
 * 최대 10개로 제한하여 Finnhub 분당 60회 API 제한 내에서 운영
 *
 * @param symbols 종목 심볼 배열
 * @param isWebSocketConnected WebSocket 연결 상태 — true면 REST 폴링 비활성화
 */
export function useMultipleStockPrices(symbols: string[], isWebSocketConnected = false) {
  const limited = symbols.slice(0, 10);

  const q0 = useStockPrice(limited[0] ?? '', isWebSocketConnected);
  const q1 = useStockPrice(limited[1] ?? '', isWebSocketConnected);
  const q2 = useStockPrice(limited[2] ?? '', isWebSocketConnected);
  const q3 = useStockPrice(limited[3] ?? '', isWebSocketConnected);
  const q4 = useStockPrice(limited[4] ?? '', isWebSocketConnected);
  const q5 = useStockPrice(limited[5] ?? '', isWebSocketConnected);
  const q6 = useStockPrice(limited[6] ?? '', isWebSocketConnected);
  const q7 = useStockPrice(limited[7] ?? '', isWebSocketConnected);
  const q8 = useStockPrice(limited[8] ?? '', isWebSocketConnected);
  const q9 = useStockPrice(limited[9] ?? '', isWebSocketConnected);

  const queries = [q0, q1, q2, q3, q4, q5, q6, q7, q8, q9];

  const results = useMemo(
    () =>
      limited.map((symbol, i) => ({
        symbol,
        price: queries[i].data?.currentPrice,
        isLoading: queries[i].isLoading,
        isError: queries[i].isError,
        error: queries[i].error,
        refetch: queries[i].refetch,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [limited.join(','), ...queries.map((q) => q.data?.currentPrice), ...queries.map((q) => q.isError)],
  );

  // 전체 에러 상태 — 하나라도 에러면 true
  const hasError = queries.some((q) => q.isError);

  // 전체 재시도 함수 — 에러 발생한 쿼리만 재시도
  const refetchAll = () => {
    queries.forEach((q) => {
      if (q.isError) q.refetch();
    });
  };

  return { results, hasError, refetchAll };
}
