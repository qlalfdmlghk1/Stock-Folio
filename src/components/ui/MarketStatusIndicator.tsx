import React from 'react';
import type { Market } from '@/types/stock';
import { useMarketStatus } from '@/hooks/useMarketStatus';

/**
 * 헤더의 장 상태 인디케이터
 * [의사결정] useMarketStatus 훅으로 미국/한국 장 상태를 1분 주기로 감지
 */
function MarketStatusIndicator({ market }: { market: Market }) {
  const { isOpen, label } = useMarketStatus(market);

  const dotColor = isOpen ? 'bg-green-400' : 'bg-gray-500';
  const marketLabel = market === 'US' ? 'NYSE' : 'KRX';

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`h-2 w-2 rounded-full ${dotColor}`} />
      <span className="text-gray-400">
        {marketLabel} {label}
      </span>
    </div>
  );
}

export default React.memo(MarketStatusIndicator);
