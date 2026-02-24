/**
 * useMT5TradeNotifications - Fires toast notifications when positions
 * are opened or closed in the live MT5 trading account.
 *
 * Detection logic:
 *   • New position   → ticket in current positions but NOT in previous snapshot
 *   • Closed position → ticket in previous positions but NOT in current snapshot
 *     (matched against tradeHistory for P&L details when available)
 */

'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { MT5TradePosition, MT5ClosedTrade } from '@/lib/types/mt5';

/**
 * Format a number as currency string (e.g. +$123.45 or -$42.10)
 */
function formatPnl(value: number): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

export function useMT5TradeNotifications(
  positions: MT5TradePosition[],
  tradeHistory: MT5ClosedTrade[],
  isConnected: boolean,
) {
  // Previous snapshots for diff detection
  const prevPositionsRef = useRef<Map<number, MT5TradePosition>>(new Map());
  // Track whether we've loaded the initial state (skip notifications on first load)
  const initializedRef = useRef(false);

  useEffect(() => {
    // Don't fire notifications when not connected
    if (!isConnected) {
      initializedRef.current = false;
      prevPositionsRef.current = new Map();
      return;
    }

    const currentMap = new Map(positions.map((p) => [p.ticket, p]));
    const prevMap = prevPositionsRef.current;

    // On first data load, just capture the snapshot — don't fire notifications
    if (!initializedRef.current) {
      if (positions.length > 0 || tradeHistory.length > 0) {
        prevPositionsRef.current = currentMap;
        initializedRef.current = true;
      }
      return;
    }

    // --- Detect newly opened positions ---
    for (const [ticket, pos] of currentMap) {
      if (!prevMap.has(ticket)) {
        toast.success(`Position Opened: ${pos.type_str} ${pos.symbol}`, {
          description: `Ticket #${ticket} · ${pos.volume} lot${pos.volume !== 1 ? 's' : ''} @ ${pos.price_open}`,
          duration: 6000,
        });
      }
    }

    // --- Detect closed positions ---
    for (const [ticket, prevPos] of prevMap) {
      if (!currentMap.has(ticket)) {
        // Try to find matching closed trade in history for P&L details
        const closed = tradeHistory.find((t) => t.ticket_in === ticket);

        if (closed) {
          const pnl = closed.profit + closed.swap + closed.commission;
          const isProfit = pnl >= 0;
          const toastFn = isProfit ? toast.success : toast.error;

          toastFn(
            `Position Closed: ${closed.symbol} ${formatPnl(pnl)}`,
            {
              description: `${closed.type} · ${closed.volume} lot${closed.volume !== 1 ? 's' : ''} · Entry ${closed.entry_price} → Exit ${closed.exit_price}`,
              duration: 8000,
            },
          );
        } else {
          // Trade history hasn't refreshed yet — show basic notification
          toast.info(`Position Closed: ${prevPos.symbol}`, {
            description: `${prevPos.type_str} · Ticket #${ticket} · ${prevPos.volume} lot${prevPos.volume !== 1 ? 's' : ''}`,
            duration: 6000,
          });
        }
      }
    }

    // Update snapshot for next comparison
    prevPositionsRef.current = currentMap;
  }, [positions, tradeHistory, isConnected]);
}
