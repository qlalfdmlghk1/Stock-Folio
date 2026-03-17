import { useState, useMemo } from "react";
import type { PortfolioStock, PieChartItem, LineChartPoint } from "../../types/stock";
import { useMultipleStockPrices } from "../../hooks/useMultipleStockPrices";
import { useMultipleCandles } from "../../hooks/useMultipleCandles";
import { useStockCandles } from "../../hooks/useStockCandles";
import { calcMarketValue } from "../../utils/calculator";
import { buildPortfolioHistoryFromMap } from "../../utils/portfolioHistory";
import PortfolioTable from "./PortfolioTable";
import PieChart from "../charts/PieChart";
import LineChart from "../charts/LineChart";
import CandlestickChart from "../charts/CandlestickChart";
import AppSelect from "../ui/AppSelect/AppSelect";

/**
 * 미국 주식 포트폴리오 섹션
 * [의사결정] Finnhub REST API로 실시간 시세 조회 — 종목별 useStockPrice 호출
 * [의사결정] 차트 3종 통합 — 파이(비중) + 라인(손익 추이) + 캔들스틱(종목 클릭 시)
 */
export default function USPortfolioSection({
  stocks,
  onEdit,
  onDelete,
}: {
  stocks: PortfolioStock[];
  onEdit: (stock: PortfolioStock) => void;
  onDelete: (id: string) => void;
}) {
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const symbols = stocks.map((s) => s.symbol);
  const priceQueries = useMultipleStockPrices(symbols);

  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    priceQueries.forEach(({ symbol, price }) => {
      if (price !== undefined) {
        map[symbol] = price;
      }
    });
    return map;
  }, [priceQueries]);

  // [의사결정] 파이차트 데이터 — 현재가 * 수량으로 종목별 평가금액 비중 계산
  const pieData = useMemo<PieChartItem[]>(() => {
    return stocks
      .filter((s) => priceMap[s.symbol] !== undefined)
      .map((s) => ({
        name: s.name,
        symbol: s.symbol,
        value: calcMarketValue(priceMap[s.symbol], s.quantity),
      }));
  }, [stocks, priceMap]);

  // 캔들스틱 차트 — 선택된 종목의 일봉 데이터
  const { data: candleResult } = useStockCandles(selectedSymbol, "US");

  // [의사결정] 라인차트 — 보유 종목들의 과거 일봉으로 날짜별 포트폴리오 손익 역산
  const allCandleQueries = useMultipleCandles(symbols, "US");
  const lineData = useMemo<LineChartPoint[]>(() => {
    return buildPortfolioHistoryFromMap(stocks, allCandleQueries);
  }, [stocks, allCandleQueries]);

  const selectedStock = stocks.find((s) => s.symbol === selectedSymbol);

  return (
    <>
      <PortfolioTable stocks={stocks} market="US" priceMap={priceMap} onEdit={onEdit} onDelete={onDelete} />

      {/* 차트 섹션 */}
      {stocks.length > 0 && (
        <div className="mt-6 space-y-6">
          {/* 파이차트 + 라인차트 가로 배치 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <PieChart data={pieData} market="US" />
            <LineChart data={lineData} market="US" />
          </div>

          {/* 캔들스틱 차트 — 종목 선택 UI */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="mb-3 flex items-center gap-4">
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
            {selectedSymbol && candleResult ? (
              <>
                {!candleResult.isRealData && (
                  <div className="mb-2 rounded-md border border-yellow-800/50 bg-yellow-900/20 px-3 py-1.5 text-xs text-yellow-500">
                    현재 표시되는 데이터는 시뮬레이션입니다 (API 한도 초과 시 자동 전환)
                  </div>
                )}
                <CandlestickChart
                  data={candleResult.candles}
                  symbol={selectedStock?.name ? `${selectedStock.name} (${selectedSymbol})` : selectedSymbol}
                  market="US"
                />
              </>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <p className="text-sm text-gray-500">
                  {selectedSymbol ? "일봉 데이터를 불러오는 중..." : "종목을 선택하면 일봉 차트가 표시됩니다."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
