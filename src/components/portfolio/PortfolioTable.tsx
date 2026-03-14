import { memo, useMemo } from 'react';
import type { PortfolioStock, Market } from '../../types/stock';
import { formatCurrency } from '../../utils/formatter';
import {
  calcReturnRate,
  calcProfitLoss,
  calcMarketValue,
  calcTotalCost,
  calcPortfolioReturnRate,
} from '../../utils/calculator';
import ProfitBadge from './ProfitBadge';

interface PortfolioTableProps {
  stocks: PortfolioStock[];
  market: Market;
  /** 종목별 현재가 맵 — key: symbol */
  priceMap: Record<string, number>;
  onEdit: (stock: PortfolioStock) => void;
  onDelete: (id: string) => void;
}

/**
 * 포트폴리오 종목 테이블
 * [성능] React.memo 적용 — stocks, priceMap이 변경될 때만 리렌더링
 * [의사결정] 한국식 색상 적용 (수익 빨강, 손실 파랑)
 */
const PortfolioTable = memo(function PortfolioTable({
  stocks,
  market,
  priceMap,
  onEdit,
  onDelete,
}: PortfolioTableProps) {
  // [성능] useMemo — 가격 변경 시에만 요약 데이터 재계산
  const summary = useMemo(() => {
    let totalCost = 0;
    let totalMarketValue = 0;
    let totalProfitLoss = 0;

    stocks.forEach((stock) => {
      const currentPrice = priceMap[stock.symbol] ?? stock.avgPrice;
      totalCost += calcTotalCost(stock.avgPrice, stock.quantity);
      totalMarketValue += calcMarketValue(currentPrice, stock.quantity);
      totalProfitLoss += calcProfitLoss(currentPrice, stock.avgPrice, stock.quantity);
    });

    return {
      totalCost,
      totalMarketValue,
      totalProfitLoss,
      totalReturnRate: calcPortfolioReturnRate(totalProfitLoss, totalCost),
    };
  }, [stocks, priceMap]);

  if (stocks.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center">
        <p className="text-gray-500">등록된 종목이 없습니다.</p>
        <p className="mt-1 text-sm text-gray-600">
          위의 &quot;종목 등록&quot; 버튼을 눌러 종목을 추가하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          label="총 매입금액"
          value={formatCurrency(summary.totalCost, market)}
        />
        <SummaryCard
          label="총 평가금액"
          value={formatCurrency(summary.totalMarketValue, market)}
        />
        <SummaryCard
          label="총 평가손익"
          value={formatCurrency(summary.totalProfitLoss, market)}
          badge={<ProfitBadge value={summary.totalReturnRate} />}
          valueColor={summary.totalProfitLoss >= 0 ? 'text-red-400' : 'text-blue-400'}
        />
      </div>

      {/* 종목 리스트 */}
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900 text-left text-gray-400">
              <th className="px-4 py-3 font-medium">종목</th>
              <th className="px-4 py-3 text-right font-medium">현재가</th>
              <th className="px-4 py-3 text-right font-medium">매입가</th>
              <th className="px-4 py-3 text-right font-medium">수량</th>
              <th className="px-4 py-3 text-right font-medium">평가손익</th>
              <th className="px-4 py-3 text-right font-medium">수익률</th>
              <th className="px-4 py-3 text-center font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock) => {
              const currentPrice = priceMap[stock.symbol] ?? stock.avgPrice;
              const profitLoss = calcProfitLoss(currentPrice, stock.avgPrice, stock.quantity);
              const returnRate = calcReturnRate(currentPrice, stock.avgPrice);
              const isProfit = profitLoss >= 0;

              return (
                <tr
                  key={stock.id}
                  className="border-b border-gray-800/50 transition hover:bg-gray-800/30"
                >
                  {/* 종목 정보 */}
                  <td className="px-4 py-3">
                    <div className="font-medium">{stock.symbol}</div>
                    <div className="text-xs text-gray-500">{stock.name}</div>
                  </td>

                  {/* 현재가 */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(currentPrice, market)}
                  </td>

                  {/* 매입가 */}
                  <td className="px-4 py-3 text-right tabular-nums text-gray-400">
                    {formatCurrency(stock.avgPrice, market)}
                  </td>

                  {/* 수량 */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {stock.quantity.toLocaleString()}주
                  </td>

                  {/* 평가손익 */}
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-medium ${
                      isProfit ? 'text-red-400' : 'text-blue-400'
                    }`}
                  >
                    {formatCurrency(profitLoss, market)}
                  </td>

                  {/* 수익률 */}
                  <td className="px-4 py-3 text-right">
                    <ProfitBadge value={returnRate} />
                  </td>

                  {/* 관리 버튼 */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => onEdit(stock)}
                        className="rounded px-2 py-1 text-xs text-gray-400 transition hover:bg-gray-700 hover:text-gray-200"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => onDelete(stock.id)}
                        className="rounded px-2 py-1 text-xs text-gray-400 transition hover:bg-red-900/50 hover:text-red-400"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

/** 요약 카드 내부 컴포넌트 */
function SummaryCard({
  label,
  value,
  badge,
  valueColor,
}: {
  label: string;
  value: string;
  badge?: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${valueColor ?? ''}`}>
        {value}
      </p>
      {badge && <div className="mt-1">{badge}</div>}
    </div>
  );
}

export default PortfolioTable;
