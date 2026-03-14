import { useState, useMemo, useCallback } from 'react';
import type { PortfolioStock, StockFormData, Market, PieChartItem, LineChartPoint, CandlestickData } from './types/stock';
import { usePortfolio } from './hooks/usePortfolio';
import { useStockPrice } from './hooks/useStockPrice';
import { useStockCandles } from './hooks/useStockCandles';
import { fetchKrxMockQuote, isKrxMarketOpen, generateKrxMockCandles } from './services/mockKrx';
import { calcMarketValue, calcProfitLoss, calcTotalCost, calcPortfolioReturnRate } from './utils/calculator';
import StockForm from './components/portfolio/StockForm';
import PortfolioTable from './components/portfolio/PortfolioTable';
import PieChart from './components/charts/PieChart';
import LineChart from './components/charts/LineChart';
import CandlestickChart from './components/charts/CandlestickChart';

function App() {
  const [activeMarket, setActiveMarket] = useState<Market>('US');
  const [showForm, setShowForm] = useState(false);
  const [editingStock, setEditingStock] = useState<PortfolioStock | undefined>();

  const { stocks, add, update, remove } = usePortfolio(activeMarket);

  /** 종목 등록 */
  const handleAdd = useCallback(
    (data: StockFormData) => {
      add(data);
      setShowForm(false);
    },
    [add],
  );

  /** 종목 수정 */
  const handleEdit = useCallback((stock: PortfolioStock) => {
    setEditingStock(stock);
    setShowForm(true);
  }, []);

  /** 종목 수정 제출 */
  const handleUpdate = useCallback(
    (data: StockFormData) => {
      if (editingStock) {
        update(editingStock.id, data);
        setEditingStock(undefined);
        setShowForm(false);
      }
    },
    [editingStock, update],
  );

  /** 종목 삭제 */
  const handleDelete = useCallback(
    (id: string) => {
      if (window.confirm('이 종목을 삭제하시겠습니까?')) {
        remove(id);
      }
    },
    [remove],
  );

  /** 폼 닫기 */
  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingStock(undefined);
  }, []);

  /** 탭 전환 시 폼 닫기 */
  const handleTabChange = useCallback((market: Market) => {
    setActiveMarket(market);
    setShowForm(false);
    setEditingStock(undefined);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* 헤더 */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            Stock<span className="text-blue-400">Folio</span>
          </h1>
          <MarketStatusIndicator market={activeMarket} />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* 미국/한국 탭 */}
        <div className="mb-6 flex gap-1 rounded-lg bg-gray-900 p-1">
          <TabButton
            active={activeMarket === 'US'}
            onClick={() => handleTabChange('US')}
          >
            미국 주식
          </TabButton>
          <TabButton
            active={activeMarket === 'KR'}
            onClick={() => handleTabChange('KR')}
          >
            한국 주식
          </TabButton>
        </div>

        {/* 종목 등록 버튼 */}
        {!showForm && (
          <div className="mb-6">
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
            >
              + 종목 등록
            </button>
          </div>
        )}

        {/* 등록/수정 폼 */}
        {showForm && (
          <div className="mb-6">
            <StockForm
              market={activeMarket}
              editingStock={editingStock}
              onSubmit={editingStock ? handleUpdate : handleAdd}
              onCancel={handleCancel}
            />
          </div>
        )}

        {/* 포트폴리오 테이블 */}
        {activeMarket === 'US' ? (
          <USPortfolioSection
            stocks={stocks}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ) : (
          <KRPortfolioSection
            stocks={stocks}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </main>
    </div>
  );
}

/**
 * 미국 주식 포트폴리오 섹션
 * [의사결정] Finnhub REST API로 실시간 시세 조회 — 종목별 useStockPrice 호출
 * [의사결정] 차트 3종 통합 — 파이(비중) + 라인(손익 추이) + 캔들스틱(종목 클릭 시)
 */
function USPortfolioSection({
  stocks,
  onEdit,
  onDelete,
}: {
  stocks: PortfolioStock[];
  onEdit: (stock: PortfolioStock) => void;
  onDelete: (id: string) => void;
}) {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
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
  const { data: candleData } = useStockCandles(selectedSymbol, 'US');

  // [의사결정] 라인차트 — 보유 종목들의 과거 일봉으로 날짜별 포트폴리오 손익 역산
  const allCandleQueries = useMultipleCandles(symbols, 'US');
  const lineData = useMemo<LineChartPoint[]>(() => {
    return buildPortfolioHistory(stocks, allCandleQueries, priceMap);
  }, [stocks, allCandleQueries, priceMap]);

  const selectedStock = stocks.find((s) => s.symbol === selectedSymbol);

  return (
    <>
      <PortfolioTable
        stocks={stocks}
        market="US"
        priceMap={priceMap}
        onEdit={onEdit}
        onDelete={onDelete}
      />

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
            {selectedSymbol && candleData ? (
              <CandlestickChart
                data={candleData}
                symbol={selectedStock?.name ? `${selectedStock.name} (${selectedSymbol})` : selectedSymbol}
                market="US"
              />
            ) : (
              <div className="flex h-64 items-center justify-center">
                <p className="text-sm text-gray-500">
                  {selectedSymbol ? '일봉 데이터를 불러오는 중...' : '종목을 선택하면 일봉 차트가 표시됩니다.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * 한국 주식 포트폴리오 섹션
 * [의사결정] KRX Mock 데이터 사용 — 장중 시간에만 시뮬레이션 활성화
 * [의사결정] 차트 3종 통합 — 파이(비중) + 라인(손익 추이) + 캔들스틱(종목 클릭 시)
 */
function KRPortfolioSection({
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

/**
 * 여러 종목의 현재가를 동시에 조회하는 훅
 * [의사결정] 각 심볼마다 독립적인 useStockPrice 호출 — TanStack Query가 캐시 관리
 * 최대 10개로 제한하여 Finnhub 분당 60회 API 제한 내에서 운영
 */
function useMultipleStockPrices(symbols: string[]) {
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

  return limited.map((symbol, i) => ({
    symbol,
    price: queries[i].data?.currentPrice,
    isLoading: queries[i].isLoading,
    isError: queries[i].isError,
  }));
}

/**
 * 여러 종목의 캔들 데이터를 동시에 조회하는 훅
 * [의사결정] 라인차트 손익 역산을 위해 보유 종목 전체의 과거 일봉 필요
 */
function useMultipleCandles(symbols: string[], market: Market) {
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

  return limited.reduce<Record<string, CandlestickData[]>>((acc, symbol, i) => {
    if (queries[i].data) {
      acc[symbol] = queries[i].data!;
    }
    return acc;
  }, {});
}

/**
 * 보유 종목의 과거 일봉 데이터로 날짜별 포트폴리오 손익을 역산한다.
 * [의사결정] 각 날짜의 종가 기준으로 "그날 포트폴리오를 보유하고 있었다면" 손익 계산
 */
function buildPortfolioHistory(
  stocks: PortfolioStock[],
  candleMap: Record<string, CandlestickData[]>,
  _priceMap: Record<string, number>,
): LineChartPoint[] {
  return buildPortfolioHistoryFromMap(stocks, candleMap);
}

/**
 * 캔들 데이터 맵에서 날짜별 포트폴리오 손익을 계산한다.
 */
function buildPortfolioHistoryFromMap(
  stocks: PortfolioStock[],
  candleMap: Record<string, CandlestickData[]>,
): LineChartPoint[] {
  if (stocks.length === 0) return [];

  // 모든 종목의 날짜를 수집하여 공통 날짜 목록 생성
  const allDates = new Set<string>();
  Object.values(candleMap).forEach((candles) => {
    candles.forEach((c) => allDates.add(c.date));
  });

  const sortedDates = Array.from(allDates).sort();
  if (sortedDates.length === 0) return [];

  // 종목별 날짜→종가 맵 생성
  const priceByDateMap: Record<string, Record<string, number>> = {};
  Object.entries(candleMap).forEach(([symbol, candles]) => {
    priceByDateMap[symbol] = {};
    candles.forEach((c) => {
      priceByDateMap[symbol][c.date] = c.close;
    });
  });

  // 총 매입금액
  const totalCost = stocks.reduce((sum, s) => sum + calcTotalCost(s.avgPrice, s.quantity), 0);

  return sortedDates.map((date) => {
    let totalValue = 0;
    let hasData = false;

    stocks.forEach((s) => {
      const closePrice = priceByDateMap[s.symbol]?.[date];
      if (closePrice !== undefined) {
        totalValue += calcMarketValue(closePrice, s.quantity);
        hasData = true;
      } else {
        // 해당 날짜에 데이터 없으면 매입가 기준 (변동 없음 처리)
        totalValue += calcMarketValue(s.avgPrice, s.quantity);
      }
    });

    if (!hasData) return null;

    const profitLoss = totalValue - totalCost;
    const returnRate = calcPortfolioReturnRate(profitLoss, totalCost);

    return { date, profitLoss, returnRate };
  }).filter((point): point is LineChartPoint => point !== null);
}

/** 탭 버튼 */
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 cursor-pointer rounded-md px-4 py-2 text-sm font-medium transition ${
        active
          ? 'bg-gray-800 text-white shadow-sm'
          : 'text-gray-400 hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

/** 장 상태 표시 인디케이터 */
function MarketStatusIndicator({ market }: { market: Market }) {
  // [의사결정] 미국 장 상태는 4주차 WebSocket 구현 시 정확히 감지 예정
  if (market === 'KR') {
    const isOpen = isKrxMarketOpen();
    return (
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`h-2 w-2 rounded-full ${isOpen ? 'bg-green-400' : 'bg-gray-600'}`}
        />
        <span className="text-gray-400">
          KRX {isOpen ? '장중' : '장 마감'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="h-2 w-2 rounded-full bg-blue-400" />
      <span className="text-gray-400">Finnhub REST 폴링</span>
    </div>
  );
}

export default App;
