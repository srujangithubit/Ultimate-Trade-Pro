/**
 * MT5Context - React context providing MT5 state and actions to the component tree.
 */

'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import type { MT5ContextValue, MT5Credentials } from '@/lib/types/mt5';
import { useMT5WebSocket } from '@/lib/hooks/useMT5WebSocket';
import { useMT5TradeNotifications } from '@/lib/hooks/useMT5TradeNotifications';
import { mt5Api } from '@/lib/api/mt5';

type OrderParams = Parameters<typeof mt5Api.placeOrder>[0];
type OrderResult = Awaited<ReturnType<typeof mt5Api.placeOrder>>;

const MT5Context = createContext<MT5ContextValue | null>(null);

export function MT5Provider({ children }: { children: React.ReactNode }) {
  const {
    status,
    account,
    positions,
    tradeHistory,
    ticks,
    subscribe,
    unsubscribe,
    refreshAccount,
    refreshPositions,
    refreshTradeHistory,
    onTick,
    offTick,
  } = useMT5WebSocket();

  // Fire toast notifications when positions open / close
  useMT5TradeNotifications(positions, tradeHistory, status.connected);

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(
    async (credentials: MT5Credentials): Promise<boolean> => {
      setIsConnecting(true);
      setError(null);
      try {
        const result = await mt5Api.connect(
          credentials.server,
          credentials.login,
          credentials.password,
        );
        if (result.success) {
          refreshAccount();
          refreshPositions();
          refreshTradeHistory(30);
        } else {
          setError('Failed to connect. Check your credentials.');
        }
        return result.success;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Connection failed';
        setError(msg);
        return false;
      } finally {
        setIsConnecting(false);
      }
    },
    [refreshAccount, refreshPositions, refreshTradeHistory],
  );

  const disconnect = useCallback(async () => {
    try {
      await mt5Api.disconnect();
    } catch (err) {
      console.error('[MT5Context] Disconnect failed:', err);
    }
  }, []);

  const placeOrder = useCallback(async (params: OrderParams): Promise<OrderResult> => {
    const result = await mt5Api.placeOrder(params);
    // Refresh positions and account after order
    refreshPositions();
    refreshAccount();
    return result;
  }, [refreshPositions, refreshAccount]);

  const closePosition = useCallback(async (ticket: number, volume?: number): Promise<OrderResult> => {
    const result = await mt5Api.closePosition(ticket, volume);
    refreshPositions();
    refreshAccount();
    refreshTradeHistory(30);
    return result;
  }, [refreshPositions, refreshAccount, refreshTradeHistory]);

  const modifyPosition = useCallback(async (ticket: number, sl?: number, tp?: number): Promise<OrderResult> => {
    const result = await mt5Api.modifyPosition(ticket, sl, tp);
    refreshPositions();
    return result;
  }, [refreshPositions]);

  const value: MT5ContextValue = {
    status,
    account,
    positions,
    tradeHistory,
    ticks,
    isConnecting,
    error,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    refreshAccount,
    refreshPositions,
    refreshTradeHistory,
    placeOrder,
    closePosition,
    modifyPosition,
    onTick,
    offTick,
  };

  return <MT5Context.Provider value={value}>{children}</MT5Context.Provider>;
}

export function useMT5() {
  const context = useContext(MT5Context);
  if (!context) {
    throw new Error('useMT5 must be used within an MT5Provider');
  }
  return context;
}

export default MT5Context;
