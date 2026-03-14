/** USD 통화 포맷 */
export function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

/** 퍼센트 포맷 (소수점 2자리) */
export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/** 변동값 포맷 (부호 포함) */
export function formatChange(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

/** KRW 통화 포맷 */
export function formatKRW(value: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(value);
}

/** 시장에 따라 통화 포맷 자동 선택 */
export function formatCurrency(value: number, market: 'US' | 'KR'): string {
  return market === 'US' ? formatUSD(value) : formatKRW(value);
}
