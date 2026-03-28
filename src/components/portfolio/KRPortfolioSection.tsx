import { useState, useMemo } from 'react';
import type { PortfolioStock, PieChartItem, LineChartPoint, CandlestickData } from '@/types/stock';
import { isKrxMarketOpen } from '@/services/mockKrx';
import { useKrxStockPrice } from '@/hooks/useKrxStockPrice';
import { useStockCandles } from '@/hooks/useStockCandles';
import { useMultipleCandles } from '@/hooks/useMultipleCandles';
import { calcMarketValue } from '@/utils/calculator';
import { buildPortfolioHistoryFromMap } from '@/utils/portfolioHistory';
import PortfolioTable from '@/components/portfolio/PortfolioTable';
import PieChart from '@/components/charts/PieChart';
import LineChart from '@/components/charts/LineChart';
import CandlestickChart from '@/components/charts/CandlestickChart';
import AppSelect from '@/components/ui/AppSelect/AppSelect';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import StockSummary from '@/components/ui/StockSummary';

/**
 * 한국 주식 포트폴리오 섹션
 * [의사결정] 공공데이터포털 API로 실제 시세 조회 — API 실패 시 Mock fallback
 * [의사결정] 차트 3종 통합 — 파이(비중) + 라인(손익 추이) + 캔들스틱(종목 클릭 시)
 */
export default function KRPortfolioSection({
  stocks,
  onEdit,
  onDelete,
}: {
  stocks: PortfolioStock[];
  onEdit: (stock: PortfolioStock) => void;
  onDelete: (id: string) => void;
}) {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');

  // [의사결정] 최대 10개 종목까지 개별 쿼리로 시세 조회 (TanStack Query 캐시 관리)
  const limited = stocks.slice(0, 10);
  const q0 = useKrxStockPrice(limited[0]?.symbol ?? '');
  const q1 = useKrxStockPrice(limited[1]?.symbol ?? '');
  const q2 = useKrxStockPrice(limited[2]?.symbol ?? '');
  const q3 = useKrxStockPrice(limited[3]?.symbol ?? '');
  const q4 = useKrxStockPrice(limited[4]?.symbol ?? '');
  const q5 = useKrxStockPrice(limited[5]?.symbol ?? '');
  const q6 = useKrxStockPrice(limited[6]?.symbol ?? '');
  const q7 = useKrxStockPrice(limited[7]?.symbol ?? '');
  const q8 = useKrxStockPrice(limited[8]?.symbol ?? '');
  const q9 = useKrxStockPrice(limited[9]?.symbol ?? '');
  const queries = [q0, q1, q2, q3, q4, q5, q6, q7, q8, q9];

  // 시세 데이터가 Mock인지 실제 API인지 판별
  const isMockData = useMemo(() => {
    const loadedQueries = limited.map((_, i) => queries[i]?.data).filter(Boolean);
    if (loadedQueries.length === 0) return false;
    return loadedQueries.some((result) => !result?.isRealData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limited.map((s) => s.symbol).join(','), ...queries.map((q) => q.data?.isRealData)]);

  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    limited.forEach((stock, i) => {
      const quote = queries[i]?.data?.quote;
      if (quote) {
        map[stock.symbol] = quote.currentPrice;
      }
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limited.map((s) => s.symbol).join(','), ...queries.map((q) => q.data?.quote?.currentPrice)]);

  // 파이차트 데이터
  const pieData = useMemo<PieChartItem[]>(() => {
    return stocks
      .filter((s) => priceMap[s.symbol] !== undefined)
      .map((s) => ({
        name: s.name,
        symbol: s.symbol,
        value: calcMarketValue(priceMap[s.symbol], s.quantity),
      }));
  }, [stocks, priceMap]);

  // 캔들스틱 — 공공데이터포털 API (실패 시 Mock fallback)
  const { data: candleResult } = useStockCandles(selectedSymbol, 'KR');
  const candleData = useMemo<CandlestickData[]>(() => {
    return candleResult?.candles ?? [];
  }, [candleResult]);

  // 라인차트 — 전체 종목 캔들로 손익 역산
  const allCandleData = useMultipleCandles(
    stocks.map((s) => s.symbol),
    'KR',
  );

  const lineData = useMemo<LineChartPoint[]>(() => {
    return buildPortfolioHistoryFromMap(stocks, allCandleData);
  }, [stocks, allCandleData]);

  const selectedStock = stocks.find((s) => s.symbol === selectedSymbol);

  return (
    <>
      {!isKrxMarketOpen() && stocks.length > 0 && (
        <div className="mb-4 rounded-lg border border-yellow-800/50 bg-yellow-950/30 px-4 py-2.5 text-sm text-yellow-400">
          한국 장 마감 상태입니다. 기준가가 표시됩니다.
        </div>
      )}
      {isMockData && stocks.length > 0 && (
        <div className="mb-4 rounded-lg border border-orange-800/50 bg-orange-950/30 px-4 py-2.5 text-sm text-orange-400">
          현재 Mock 데이터입니다. 실제 값과 다를 수 있습니다.
        </div>
      )}
      <PortfolioTable
        stocks={stocks}
        market="KR"
        priceMap={priceMap}
        onEdit={onEdit}
        onDelete={onDelete}
      />

      {/* 차트 섹션 */}
      {stocks.length > 0 && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ErrorBoundary>
              <PieChart data={pieData} market="KR" />
            </ErrorBoundary>
            <ErrorBoundary>
              <LineChart data={lineData} market="KR" />
            </ErrorBoundary>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="mb-3 flex items-center gap-3">
              <h3 className="text-sm font-medium text-gray-400">종목 일봉 차트</h3>
              <AppSelect
                options={stocks.map((s) => ({
                  value: s.symbol,
                  label: `${s.name} (${s.symbol})`,
                }))}
                value={selectedSymbol || undefined}
                onChange={(val) => setSelectedSymbol(val as string)}
                placeholder="종목 선택"
                size="sm"
                width="50%"
              />
            </div>
            <ErrorBoundary>
              {selectedSymbol && candleData.length > 0 ? (
                <>
                  <CandlestickChart
                    data={candleData}
                    symbol={selectedStock?.name ? `${selectedStock.name} (${selectedSymbol})` : selectedSymbol}
                    market="KR"
                  />
                  {/* [의사결정] AI 종목 요약 — 캔들스틱 차트 아래에 Gemini 기반 동향 요약 표시 */}
                  {selectedStock && (
                    <StockSummary symbol={selectedSymbol} name={selectedStock.name} market="KR" />
                  )}
                </>
              ) : (
                <div className="flex h-64 items-center justify-center">
                  <p className="text-sm text-gray-500">종목을 선택하면 일봉 차트가 표시됩니다.</p>
                </div>
              )}
            </ErrorBoundary>
          </div>
        </div>
      )}
    </>
  );
}
