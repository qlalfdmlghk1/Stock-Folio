import { useMemo } from 'react';
import { useStockCandles } from './useStockCandles';
import type { CandlestickData, Market } from '@/types/stock';

/**
 * 여러 종목의 캔들 데이터를 동시에 조회하는 훅
 * [의사결정] 라인차트 손익 역산을 위해 보유 종목 전체의 과거 일봉 필요
 */
export function useMultipleCandles(symbols: string[], market: Market) {
  // 최대 10개로 제한 (API 호출 한도 대비)
  const limited = symbols.slice(0, 10);

  const q0 = useStockCandles(limited[0] ?? '', market);
  const q1 = useStockCandles(limited[1] ?? '', market);
  const q2 = useStockCandles(limited[2] ?? '', market);
  const q3 = useStockCandles(limited[3] ?? '', market);
  const q4 = useStockCandles(limited[4] ?? '', market);
  const q5 = useStockCandles(limited[5] ?? '', market);
  const q6 = useStockCandles(limited[6] ?? '', market);
  const q7 = useStockCandles(limited[7] ?? '', market);
  const q8 = useStockCandles(limited[8] ?? '', market);
  const q9 = useStockCandles(limited[9] ?? '', market);

  const queries = [q0, q1, q2, q3, q4, q5, q6, q7, q8, q9];

  return useMemo(() => {
    return limited.reduce<Record<string, CandlestickData[]>>((acc, symbol, i) => {
      if (queries[i].data) {
        acc[symbol] = queries[i].data!.candles;
      }
      return acc;
    }, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limited.join(','), ...queries.map((q) => q.dataUpdatedAt)]);
}
