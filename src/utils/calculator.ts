/** 수익률 = (현재가 - 매입가) / 매입가 * 100 */
export function calcReturnRate(currentPrice: number, avgPrice: number): number {
  if (avgPrice === 0) return 0;
  return ((currentPrice - avgPrice) / avgPrice) * 100;
}

/** 평가손익 = (현재가 - 매입가) * 수량 */
export function calcProfitLoss(
  currentPrice: number,
  avgPrice: number,
  quantity: number,
): number {
  return (currentPrice - avgPrice) * quantity;
}

/** 평가금액 = 현재가 * 수량 */
export function calcMarketValue(currentPrice: number, quantity: number): number {
  return currentPrice * quantity;
}

/** 매입금액 = 매입가 * 수량 */
export function calcTotalCost(avgPrice: number, quantity: number): number {
  return avgPrice * quantity;
}

/** 포트폴리오 전체 수익률 = 총 평가손익 / 총 매입금액 * 100 */
export function calcPortfolioReturnRate(
  totalProfitLoss: number,
  totalCost: number,
): number {
  if (totalCost === 0) return 0;
  return (totalProfitLoss / totalCost) * 100;
}
