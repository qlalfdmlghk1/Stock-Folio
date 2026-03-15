import { useState, useMemo } from 'react';
import type { PortfolioStock, PieChartItem, LineChartPoint, CandlestickData } from '../../types/stock';
import { fetchKrxMockQuote, isKrxMarketOpen, generateKrxMockCandles } from '../../services/mockKrx';
import { calcMarketValue } from '../../utils/calculator';
import { buildPortfolioHistoryFromMap } from '../../utils/portfolioHistory';
import PortfolioTable from './PortfolioTable';
import PieChart from '../charts/PieChart';
import LineChart from '../charts/LineChart';
import CandlestickChart from '../charts/CandlestickChart';

/**
 * 한국 주식 포트폴리오 섹션
 * [의사결정] KRX Mock 데이터 사용 — 장중 시간에만 시뮬레이션 활성화
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

  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    stocks.forEach((stock) => {
      const quote = fetchKrxMockQuote(stock.symbol);
      if (quote) {
        map[stock.symbol] = quote.currentPrice;
      }
    });
    return map;
  }, [stocks]);

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

  // 캔들스틱 — Mock 캔들 데이터
  const candleData = useMemo<CandlestickData[]>(() => {
    if (!selectedSymbol) return [];
    return generateKrxMockCandles(selectedSymbol, 90);
  }, [selectedSymbol]);

  // 라인차트 — Mock 캔들로 손익 역산
  const allCandleData = useMemo(() => {
    const map: Record<string, CandlestickData[]> = {};
    stocks.forEach((s) => {
      map[s.symbol] = generateKrxMockCandles(s.symbol, 90);
    });
    return map;
  }, [stocks]);

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
            <PieChart data={pieData} market="KR" />
            <LineChart data={lineData} market="KR" />
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="mb-3 flex items-center gap-3">
              <h3 className="text-sm font-medium text-gray-400">종목 일봉 차트</h3>
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200"
              >
                <option value="">종목 선택</option>
                {stocks.map((s) => (
                  <option key={s.id} value={s.symbol}>
                    {s.name} ({s.symbol})
                  </option>
                ))}
              </select>
            </div>
            {selectedSymbol && candleData.length > 0 ? (
              <CandlestickChart
                data={candleData}
                symbol={selectedStock?.name ? `${selectedStock.name} (${selectedSymbol})` : selectedSymbol}
                market="KR"
              />
            ) : (
              <div className="flex h-64 items-center justify-center">
                <p className="text-sm text-gray-500">종목을 선택하면 일봉 차트가 표시됩니다.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
