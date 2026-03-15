import type { PortfolioStock, CandlestickData, LineChartPoint } from '../types/stock';
import { calcMarketValue, calcTotalCost, calcPortfolioReturnRate } from './calculator';

/**
 * 캔들 데이터 맵에서 날짜별 포트폴리오 손익을 계산한다.
 * [의사결정] 각 날짜의 종가 기준으로 "그날 포트폴리오를 보유하고 있었다면" 손익 계산
 */
export function buildPortfolioHistoryFromMap(
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
