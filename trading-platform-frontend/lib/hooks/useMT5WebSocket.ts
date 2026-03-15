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

type TickCallback = (tick: MT5TickData) => void;

function isSamePositions(a: MT5TradePosition[], b: MT5TradePosition[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      left.ticket !== right.ticket ||
      left.symbol !== right.symbol ||
      left.type_str !== right.type_str ||
      left.volume !== right.volume ||
      left.price_open !== right.price_open ||
      left.price_current !== right.price_current ||
      left.profit !== right.profit ||
      left.swap !== right.swap ||
      left.sl !== right.sl ||
      left.tp !== right.tp ||
      left.time !== right.time
    ) {
      return false;
    }
  }

  return true;
}

function isSameTradeHistory(a: MT5ClosedTrade[], b: MT5ClosedTrade[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      left.ticket_out !== right.ticket_out ||
      left.ticket_in !== right.ticket_in ||
      left.symbol !== right.symbol ||
      left.type !== right.type ||
      left.volume !== right.volume ||
      left.entry_price !== right.entry_price ||
      left.exit_price !== right.exit_price ||
      left.profit !== right.profit ||
      left.swap !== right.swap ||
      left.commission !== right.commission ||
      left.entry_time !== right.entry_time ||
      left.exit_time !== right.exit_time
    ) {
      return false;
    }
  }

  return true;
}

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

  // Callback-based tick listeners: symbol -> Set<callback>
  // These fire synchronously on every tick, bypassing React batching
  const tickListenersRef = useRef<Map<string, Set<TickCallback>>>(new Map());

  const handleMessageRef = useRef<(msg: MT5WebSocketMessage) => void>(() => { });

  // Keep the handler ref up to date (must be in useEffect for React 19 compiler)
  useEffect(() => {
    handleMessageRef.current = (msg: MT5WebSocketMessage) => {
      switch (msg.type) {
        case 'status':
          setStatus((prev) => {
            const nextConnected = msg.connected ?? false;
            const nextAuthenticated = msg.authenticated ?? false;
            if (
              prev.connected === nextConnected &&
              prev.authenticated === nextAuthenticated
            ) {
              return prev;
            }
            return {
              connected: nextConnected,
              authenticated: nextAuthenticated,
            };
          });
          break;
        case 'auth':
          setStatus((s) => {
            const authenticated = msg.data as boolean;
            if (s.authenticated === authenticated) return s;
            return { ...s, authenticated };
          });
          break;
        case 'tick':
          if (msg.data && typeof msg.data === 'object') {
            // Gateway sends { symbol, data: { bid, ask, last, volume, time } }
            // Flatten into MT5TickData shape
            const raw = msg.data as { symbol?: string; data?: Record<string, unknown> } & MT5TickData;
            const tick: MT5TickData = raw.data && typeof raw.data === 'object'
              ? { symbol: raw.symbol ?? '', ...raw.data } as MT5TickData
              : raw;
            if (tick.symbol) {
              setTicks((prev) => {
                const existing = prev[tick.symbol];
                if (
                  existing &&
                  existing.bid === tick.bid &&
                  existing.ask === tick.ask &&
                  existing.last === tick.last &&
                  existing.volume === tick.volume &&
                  existing.time === tick.time
                ) {
                  return prev;
                }
                return { ...prev, [tick.symbol]: tick };
              });
              // Fire callback listeners synchronously (bypasses React batching)
              const listeners = tickListenersRef.current.get(tick.symbol);
              if (listeners) {
                for (const cb of listeners) {
                  try { cb(tick); } catch { /* ignore listener errors */ }
                }
              }
            }
          }
          break;
        case 'account_info':
          setAccount((prev) => {
            const raw = msg.data;
            if (!raw || typeof raw !== 'object') {
              return prev === null ? prev : null;
            }

            const next = raw as MT5AccountInfo;
            if (
              prev &&
              prev.login === next.login &&
              prev.server === next.server &&
              prev.balance === next.balance &&
              prev.equity === next.equity &&
              prev.margin === next.margin &&
              prev.free_margin === next.free_margin
            ) {
              return prev;
            }
            return next;
          });
          break;
        case 'positions':
          setPositions((prev) => {
            const next = msg.data as MT5TradePosition[];
            return isSamePositions(prev, next) ? prev : next;
          });
          break;
        case 'trade_history':
          setTradeHistory((prev) => {
            const next = msg.data as MT5ClosedTrade[];
            return isSameTradeHistory(prev, next) ? prev : next;
          });
          break;
        case 'heartbeat':
          setLastHeartbeat((prev) => {
            const next = msg.data as string;
            return prev === next ? prev : next;
          });
          break;
        case 'error':
        case 'mt5_error':
          console.error('[MT5 WebSocket]', msg.message || msg.data);
          break;
      }
    };
  }, []);

  const connectWsRef = useRef<() => void>(() => { });
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
  }, [connectWs]);

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

  // Register a callback for every tick on a specific symbol
  const onTick = useCallback((symbol: string, callback: TickCallback) => {
    const map = tickListenersRef.current;
    if (!map.has(symbol)) map.set(symbol, new Set());
    map.get(symbol)!.add(callback);
  }, []);

  // Unregister a tick callback
  const offTick = useCallback((symbol: string, callback: TickCallback) => {
    tickListenersRef.current.get(symbol)?.delete(callback);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // Defer connection to survive React Strict Mode double-invoke.
    // The first cleanup clears the timer before any WebSocket is created,
    // preventing "closed before established" warnings.
    const timer = setTimeout(() => connectWs(), 0);
    return () => {
      clearTimeout(timer);
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
    onTick,
    offTick,
  };
}
