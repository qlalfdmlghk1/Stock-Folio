import React from 'react';
import type { Market } from '../../types/stock';
import { isKrxMarketOpen } from '../../services/mockKrx';

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

export default React.memo(MarketStatusIndicator);
