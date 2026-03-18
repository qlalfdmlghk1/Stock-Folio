import { useState, useCallback } from 'react';
import type { PortfolioStock, StockFormData, Market } from '@/types/stock';
import {
  loadPortfolio,
  addStock,
  updateStock,
  removeStock,
  getStocksByMarket,
} from '@/store/portfolioStore';

/**
 * 포트폴리오 CRUD를 React 상태와 동기화하는 훅
 * [의사결정] localStorage 직접 접근 대신 store 함수를 래핑하여 React 리렌더링 보장
 */
export function usePortfolio(market?: Market) {
  const [stocks, setStocks] = useState<PortfolioStock[]>(() =>
    market ? getStocksByMarket(market) : loadPortfolio(),
  );

  /** localStorage에서 최신 상태를 다시 읽어와 React 상태에 반영 */
  const refresh = useCallback(() => {
    setStocks(market ? getStocksByMarket(market) : loadPortfolio());
  }, [market]);

  /** 종목 추가 후 상태 갱신 */
  const add = useCallback(
    (data: StockFormData) => {
      addStock(data);
      refresh();
    },
    [refresh],
  );

  /** 종목 수정 후 상태 갱신 */
  const update = useCallback(
    (id: string, data: Partial<StockFormData>) => {
      updateStock(id, data);
      refresh();
    },
    [refresh],
  );

  /** 종목 삭제 후 상태 갱신 */
  const remove = useCallback(
    (id: string) => {
      removeStock(id);
      refresh();
    },
    [refresh],
  );

  return { stocks, add, update, remove, refresh } as const;
}
