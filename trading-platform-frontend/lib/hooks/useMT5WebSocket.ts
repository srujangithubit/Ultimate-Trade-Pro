/**
 * useMT5WebSocket - Custom hook for MT5 WebSocket connection management.
 * Connects to the MT5 Node server's WebSocket endpoint for real-time data.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  MT5AccountInfo,
  MT5ClosedTrade,
  MT5ConnectionStatus,
  MT5WebSocketMessage,
  MT5TickData,
  MT5TradePosition,
} from '@/lib/types/mt5';

const MT5_WS_URL =
  process.env.NEXT_PUBLIC_MT5_WS_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://localhost:3001/ws/mt5`
    : 'ws://localhost:3001/ws/mt5');

/**
 * Gracefully dispose of a WebSocket without triggering the browser's
 * "WebSocket is closed before the connection is established" warning.
 * If the socket is still CONNECTING, we null its handlers and let it
 * open, then immediately close — avoiding the premature-close warning.
 */
function safeCloseWebSocket(ws: WebSocket) {
  ws.onmessage = null;
  ws.onerror = null;
  ws.onclose = null;

  if (ws.readyState === WebSocket.CONNECTING) {
    // Let it finish connecting, then close immediately
    ws.onopen = () => ws.close();
  } else if (ws.readyState === WebSocket.OPEN) {
    ws.onopen = null;
    ws.close();
  } else {
    ws.onopen = null;
    // CLOSING or CLOSED — nothing to do
  }
}

export function useMT5WebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mountedRef = useRef(true);

  const [status, setStatus] = useState<MT5ConnectionStatus>({
    connected: false,
    authenticated: false,
  });
  const [account, setAccount] = useState<MT5AccountInfo | null>(null);
  const [positions, setPositions] = useState<MT5TradePosition[]>([]);
  const [tradeHistory, setTradeHistory] = useState<MT5ClosedTrade[]>([]);
  const [ticks, setTicks] = useState<Record<string, MT5TickData>>({});
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const handleMessageRef = useRef<(msg: MT5WebSocketMessage) => void>(() => {});

  // Keep the handler ref up to date (must be in useEffect for React 19 compiler)
  useEffect(() => {
    handleMessageRef.current = (msg: MT5WebSocketMessage) => {
      switch (msg.type) {
        case 'status':
          setStatus({
            connected: msg.connected ?? false,
            authenticated: msg.authenticated ?? false,
          });
          break;
        case 'auth':
          setStatus((s) => ({ ...s, authenticated: msg.data as boolean }));
          break;
        case 'tick':
          if (msg.data && typeof msg.data === 'object') {
            const tick = msg.data as MT5TickData;
            setTicks((prev) => ({ ...prev, [tick.symbol]: tick }));
          }
          break;
        case 'account_info':
          setAccount(msg.data as MT5AccountInfo);
          break;
        case 'positions':
          setPositions(msg.data as MT5TradePosition[]);
          break;
        case 'trade_history':
          setTradeHistory(msg.data as MT5ClosedTrade[]);
          break;
        case 'heartbeat':
          setLastHeartbeat(msg.data as string);
          break;
        case 'error':
        case 'mt5_error':
          console.error('[MT5 WebSocket]', msg.message || msg.data);
          break;
      }
    };
  });

  const connectWsRef = useRef<() => void>(() => {});
  const hasConnectedRef = useRef(false);

  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Clean up any existing socket before creating a new one
    if (wsRef.current) {
      safeCloseWebSocket(wsRef.current);
      wsRef.current = null;
    }

    try {
      const ws = new WebSocket(MT5_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (mountedRef.current) {
          hasConnectedRef.current = true;
          setWsConnected(true);
          console.log('[useMT5WebSocket] Connected to MT5 server');
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg: MT5WebSocketMessage = JSON.parse(event.data);
          handleMessageRef.current(msg);
        } catch {
          console.error('[useMT5WebSocket] Failed to parse message');
        }
      };

      ws.onclose = () => {
        if (mountedRef.current) {
          setWsConnected(false);
          setStatus((s) => ({ ...s, connected: false }));
          if (hasConnectedRef.current) {
            console.log('[useMT5WebSocket] Disconnected, reconnecting in 5s...');
          }
          reconnectTimerRef.current = setTimeout(() => connectWsRef.current(), 5000);
        }
      };

      ws.onerror = () => {
        // Browser WS onerror doesn't expose details; only warn if we previously had a connection
        if (hasConnectedRef.current) {
          console.warn('[useMT5WebSocket] Connection error, will reconnect...');
        }
        // onerror is always followed by onclose, so reconnect is handled there
      };
    } catch (err) {
      console.error('[useMT5WebSocket] Failed to create WebSocket:', err);
      reconnectTimerRef.current = setTimeout(() => connectWsRef.current(), 5000);
    }
  }, []);

  useEffect(() => {
    connectWsRef.current = connectWs;
  });

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const subscribe = useCallback(
    (symbol: string) => send({ action: 'subscribe', symbol }),
    [send],
  );

  const unsubscribe = useCallback(
    (symbol: string) => send({ action: 'unsubscribe', symbol }),
    [send],
  );

  const refreshAccount = useCallback(
    () => send({ action: 'account_info' }),
    [send],
  );

  const refreshPositions = useCallback(
    () => send({ action: 'positions' }),
    [send],
  );

  const refreshTradeHistory = useCallback(
    (days: number = 30) => send({ action: 'trade_history', days }),
    [send],
  );

  const disconnectWs = useCallback(() => {
    clearTimeout(reconnectTimerRef.current);
    if (wsRef.current) {
      safeCloseWebSocket(wsRef.current);
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connectWs();
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        safeCloseWebSocket(wsRef.current);
        wsRef.current = null;
      }
    };
  }, [connectWs]);

  return {
    status,
    account,
    positions,
    tradeHistory,
    ticks,
    lastHeartbeat,
    wsConnected,
    subscribe,
    unsubscribe,
    refreshAccount,
    refreshPositions,
    refreshTradeHistory,
    disconnectWs,
    send,
  };
}
