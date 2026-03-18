import { useQuery } from '@tanstack/react-query';
import { fetchQuote } from '@/services/finnhub';
import { POLLING_INTERVAL } from '@/constants/api';

/**
 * Finnhub REST API로 종목 현재가를 조회하는 훅
 *
 * [의사결정] WebSocket 연결 상태에 따라 폴링 자동 전환
 * - WebSocket 정상 → refetchInterval: false (REST 호출 안 함, API 한도 절약)
 * - WebSocket 단절 → refetchInterval: 5000ms (5초 폴링 백업)
 *
 * @param symbol 종목 심볼
 * @param isWebSocketConnected WebSocket 연결 상태 (true면 폴링 비활성화)
 */
export function useStockPrice(symbol: string, isWebSocketConnected = false) {
  return useQuery({
    queryKey: ['quote', symbol],
    queryFn: () => fetchQuote(symbol),
    // [의사결정] WebSocket 연결 중에는 폴링 비활성화 — API 분당 60회 한도 절약
    // WebSocket 단절 시 자동으로 5초 폴링 전환 — UX 연속성 보장
    refetchInterval: isWebSocketConnected ? false : POLLING_INTERVAL,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
    enabled: !!symbol,
  });
}
