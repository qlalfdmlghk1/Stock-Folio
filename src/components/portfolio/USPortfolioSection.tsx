import { useMemo, useState } from "react";

import type { LineChartPoint, PieChartItem, PortfolioStock } from "@/types/stock";

import { useMarketStatus } from "@/hooks/useMarketStatus";
import { useMultipleCandles } from "@/hooks/useMultipleCandles";
import { useMultipleStockPrices } from "@/hooks/useMultipleStockPrices";
import { useStockCandles } from "@/hooks/useStockCandles";
import { useWebSocket } from "@/hooks/useWebSocket";
import { calcMarketValue } from "@/utils/calculator";
import { buildPortfolioHistoryFromMap } from "@/utils/portfolioHistory";
import CandlestickChart from "@/components/charts/CandlestickChart";
import LineChart from "@/components/charts/LineChart";
import PieChart from "@/components/charts/PieChart";
import AppSelect from "@/components/ui/AppSelect/AppSelect";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import MarketStatusBanner from "@/components/ui/MarketStatusBanner";
import StockSummary from "@/components/ui/StockSummary";
import PortfolioTable from "./PortfolioTable";

/**
 * 미국 주식 포트폴리오 섹션
 * [의사결정] WebSocket 우선 + REST 폴링 백업 — 실시간 시세 안정적 공급
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

  // [의사결정] WebSocket 연결 — 체결가 수신 시 TanStack Query 캐시 직접 업데이트
  const { isConnected: isWsConnected, status: wsStatus } = useWebSocket(symbols);
  const marketStatus = useMarketStatus('US');

  // WebSocket 연결 중이면 REST 폴링 비활성화 → API 한도 절약
  const { results: priceQueries, hasError: hasPriceError, refetchAll } = useMultipleStockPrices(symbols, isWsConnected);

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
      {/* 장 마감 배너 — 장외 시간에만 표시 */}
      <MarketStatusBanner market="US" marketStatus={marketStatus} wsStatus={wsStatus} />

      {/* [예외처리] API 실패 시 에러 메시지 + 재시도 버튼 — 금융 서비스 수준 안정성 */}
      {hasPriceError && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-800/50 bg-red-950/20 px-4 py-3">
          <p className="text-sm text-red-400">
            일부 종목의 시세를 불러오지 못했습니다.
          </p>
          <button
            onClick={refetchAll}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-500"
          >
            재시도
          </button>
        </div>
      )}

      <PortfolioTable stocks={stocks} market="US" priceMap={priceMap} onEdit={onEdit} onDelete={onDelete} />

      {/* 차트 섹션 */}
      {stocks.length > 0 && (
        <div className="mt-6 space-y-6">
          {/* [의사결정] 차트별 ErrorBoundary 격리 — 한 차트 에러가 다른 차트에 영향 안 미치도록 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ErrorBoundary>
              <PieChart data={pieData} market="US" />
            </ErrorBoundary>
            <ErrorBoundary>
              <LineChart data={lineData} market="US" />
            </ErrorBoundary>
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
            <ErrorBoundary>
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
                  {/* [의사결정] AI 종목 요약 — 캔들스틱 차트 아래에 Gemini 기반 동향 요약 표시 */}
                  {selectedStock && (
                    <StockSummary symbol={selectedSymbol} name={selectedStock.name} market="US" />
                  )}
                </>
              ) : (
                <div className="flex h-64 items-center justify-center">
                  <p className="text-sm text-gray-500">
                    {selectedSymbol ? "일봉 데이터를 불러오는 중..." : "종목을 선택하면 일봉 차트가 표시됩니다."}
                  </p>
                </div>
              )}
            </ErrorBoundary>
          </div>
        </div>
      )}
    </>
  );
}
