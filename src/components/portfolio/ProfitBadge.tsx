import { memo } from 'react';
import { formatPercent } from '../../utils/formatter';

interface ProfitBadgeProps {
  value: number;
}

/**
 * 수익률을 색상 뱃지로 표시하는 컴포넌트
 * [의사결정] 한국식 색상 — 수익 빨강(#ef4444), 손실 파랑(#3b82f6)
 * [성능] React.memo 적용 — value가 변경될 때만 리렌더링
 */
const ProfitBadge = memo(function ProfitBadge({ value }: ProfitBadgeProps) {
  const isProfit = value >= 0;

  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-sm font-semibold ${
        isProfit ? 'bg-red-950 text-red-400' : 'bg-blue-950 text-blue-400'
      }`}
    >
      {formatPercent(value)}
    </span>
  );
});

export default ProfitBadge;
