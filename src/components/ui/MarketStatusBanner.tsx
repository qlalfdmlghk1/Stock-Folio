import React from 'react';
import type { Market } from '@/types/stock';
import type { MarketStatus } from '@/hooks/useMarketStatus';
import type { WsConnectionStatus } from '@/hooks/useWebSocket';

interface MarketStatusBannerProps {
  market: Market;
  marketStatus: MarketStatus;
  /** WebSocket 연결 상태 — US 탭에서만 사용 */
  wsStatus?: WsConnectionStatus;
}

/**
 * 장 마감 / WebSocket 상태 배너
 * [의사결정] 장외 시간에는 "장 마감" 배너 표시 — 사용자에게 표시 가격이 실시간이 아님을 명확히 전달
 * [의사결정] WebSocket 단절 시 "폴링 전환" 안내 — 데이터는 계속 갱신됨을 알림
 */
function MarketStatusBanner({ market, marketStatus, wsStatus }: MarketStatusBannerProps) {
  // 장 마감 배너
  if (!marketStatus.isOpen) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-gray-500" />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-300">
            {market === 'US' ? 'NYSE/NASDAQ' : 'KRX'} {marketStatus.label}
          </p>
          <p className="text-xs text-gray-500">
            표시된 가격은 마지막 거래 종가입니다.
          </p>
        </div>
      </div>
    );
  }

  // 장중인데 WebSocket 단절 → 폴링 전환 안내 (US 탭만)
  if (market === 'US' && wsStatus && wsStatus !== 'connected') {
    const statusConfig: Record<Exclude<WsConnectionStatus, 'connected'>, { color: string; text: string }> = {
      connecting: { color: 'border-yellow-800/50 bg-yellow-900/20', text: 'WebSocket 연결 중...' },
      reconnecting: { color: 'border-yellow-800/50 bg-yellow-900/20', text: 'WebSocket 재연결 중 — REST 폴링으로 시세 갱신 중' },
      disconnected: { color: 'border-red-800/50 bg-red-900/20', text: 'WebSocket 연결 해제 — REST 폴링으로 시세 갱신 중' },
    };

    const config = statusConfig[wsStatus];

    return (
      <div className={`mb-4 flex items-center gap-3 rounded-lg border px-4 py-2.5 ${config.color}`}>
        <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
        <p className="text-xs text-yellow-400">{config.text}</p>
      </div>
    );
  }

  // 장중 + WebSocket 정상 → 배너 없음
  return null;
}

export default React.memo(MarketStatusBanner);
