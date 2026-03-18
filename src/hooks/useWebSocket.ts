import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FINNHUB_WS_URL } from '@/constants/api';
import type { StockQuote } from '@/types/stock';

/** WebSocket 연결 상태 */
export type WsConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

/** Finnhub WebSocket 체결 데이터 (trades) */
interface FinnhubWsTrade {
  /** 데이터 타입 — 'trade' */
  type: 'trade';
  data: Array<{
    /** 심볼 */
    s: string;
    /** 체결가 */
    p: number;
    /** 체결 타임스탬프 (ms) */
    t: number;
    /** 체결 수량 */
    v: number;
  }>;
}

/**
 * 재연결 대기 시간 계산 (Exponential Backoff)
 * [의사결정] 최대 30초까지 지수적 증가 — 서버 부하 방지 + 빠른 초기 복구
 */
function getReconnectDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 30_000);
}

/**
 * Finnhub WebSocket을 관리하는 훅
 *
 * [의사결정] WebSocket 체결가 수신 시 TanStack Query 캐시를 직접 업데이트
 * → useStockPrice 훅의 data가 자동으로 최신 체결가를 반영
 * → WebSocket 연결 중에는 REST 폴링을 비활성화하여 API 호출 절약
 *
 * [의사결정] 구독 목록을 ref로 관리 — 종목 추가/삭제 시 동적 구독/해제
 */
export function useWebSocket(symbols: string[]) {
  const wsRef = useRef<WebSocket | null>(null);
  const subscribedRef = useRef<Set<string>>(new Set());
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<WsConnectionStatus>('disconnected');
  // [의사결정] 마지막 체결가 수신 시각 — 연결은 됐지만 데이터가 안 오는 상태 감지용
  const [lastMessageTime, setLastMessageTime] = useState<number | null>(null);

  /** WebSocket으로 구독 메시지 전송 */
  const subscribe = useCallback((symbol: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && !subscribedRef.current.has(symbol)) {
      ws.send(JSON.stringify({ type: 'subscribe', symbol }));
      subscribedRef.current.add(symbol);
    }
  }, []);

  /** WebSocket 구독 해제 */
  const unsubscribe = useCallback((symbol: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && subscribedRef.current.has(symbol)) {
      ws.send(JSON.stringify({ type: 'unsubscribe', symbol }));
      subscribedRef.current.delete(symbol);
    }
  }, []);

  /** WebSocket 연결 수립 */
  const connect = useCallback(() => {
    // 이미 연결 중이거나 연결된 상태면 무시
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;

    setStatus('connecting');
    const ws = new WebSocket(FINNHUB_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      reconnectAttemptRef.current = 0;

      // [의사결정] 연결 성공 시 현재 symbols 전체를 다시 구독 — 재연결 시 구독 복구
      subscribedRef.current.clear();
      symbols.forEach((symbol) => {
        if (symbol) subscribe(symbol);
      });
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data as string) as FinnhubWsTrade;

        if (message.type === 'trade' && message.data?.length > 0) {
          setLastMessageTime(Date.now());

          // [의사결정] 같은 심볼의 여러 체결 중 마지막 체결가만 사용 — 가장 최신 가격
          const latestBySymbol = new Map<string, FinnhubWsTrade['data'][0]>();
          for (const trade of message.data) {
            latestBySymbol.set(trade.s, trade);
          }

          // TanStack Query 캐시에 체결가 반영
          latestBySymbol.forEach((trade, symbol) => {
            queryClient.setQueryData<StockQuote>(['quote', symbol], (prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                currentPrice: trade.p,
                timestamp: Math.floor(trade.t / 1000),
              };
            });
          });
        }
      } catch {
        // [트러블슈팅] JSON 파싱 실패는 무시 — ping/pong 등 비정형 메시지 가능
      }
    };

    ws.onclose = () => {
      setStatus('reconnecting');
      subscribedRef.current.clear();
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onerror 후 onclose가 자동 호출되므로 여기서는 상태만 기록
      ws.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(','), subscribe, queryClient]);

  /** 재연결 스케줄링 */
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    const delay = getReconnectDelay(reconnectAttemptRef.current);
    reconnectAttemptRef.current += 1;

    reconnectTimerRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  /** WebSocket 연결 해제 (클린업용) */
  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onclose = null; // 재연결 방지
      wsRef.current.close();
      wsRef.current = null;
    }

    subscribedRef.current.clear();
    setStatus('disconnected');
  }, []);

  // 마운트 시 연결, 언마운트 시 해제
  useEffect(() => {
    if (symbols.length === 0) return;

    connect();
    return () => disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(',')]);

  // symbols 변경 시 구독 목록 동기화
  useEffect(() => {
    if (status !== 'connected') return;

    const newSymbols = new Set(symbols.filter(Boolean));
    const currentSubscribed = subscribedRef.current;

    // 새로 추가된 종목 구독
    newSymbols.forEach((s) => {
      if (!currentSubscribed.has(s)) subscribe(s);
    });

    // 제거된 종목 구독 해제
    currentSubscribed.forEach((s) => {
      if (!newSymbols.has(s)) unsubscribe(s);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(','), status, subscribe, unsubscribe]);

  return {
    /** WebSocket 연결 상태 */
    status,
    /** WebSocket이 정상 연결되어 데이터 수신 가능한 상태인지 */
    isConnected: status === 'connected',
    /** 마지막 체결 데이터 수신 시각 (ms) */
    lastMessageTime,
    /** 수동 연결 해제 */
    disconnect,
    /** 수동 재연결 */
    reconnect: connect,
  } as const;
}
