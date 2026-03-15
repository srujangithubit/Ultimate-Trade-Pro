/**
 * usePriceAlerts - Hook for managing price alerts via the MT5 WebSocket.
 *
 * Creates/deletes alerts on the MT5 Node server and listens for
 * `alert_triggered` events.  When an alert fires it:
 *   1. Shows a sonner toast with symbol + price
 *   2. Fires a native browser Notification (with TradePro icon)
 *   3. Plays a short notification sound
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  direction: 'above' | 'below';
  note: string | null;
  createdAt: string;
  triggered: boolean;
}

interface AlertTriggeredPayload {
  id: string;
  symbol: string;
  targetPrice: number;
  triggeredPrice: number;
  direction: 'above' | 'below';
  note: string | null;
  triggeredAt: string;
}

const MT5_WS_URL =
  process.env.NEXT_PUBLIC_MT5_WS_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://localhost:3001/ws/mt5`
    : 'ws://localhost:3001/ws/mt5');

const MT5_REST =
  process.env.NEXT_PUBLIC_MT5_REST_URL || 'http://localhost:3001/api/mt5';

/**
 * Request browser notification permission (once).
 */
function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

/**
 * Fire a native browser notification with TradePro branding.
 */
function fireNativeNotification(alert: AlertTriggeredPayload) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const dir = alert.direction === 'above' ? '▲' : '▼';
  const title = `TradePro Alert: ${alert.symbol}`;
  const body = `${dir} Price hit ${alert.triggeredPrice} (target: ${alert.targetPrice})${alert.note ? `\n${alert.note}` : ''}`;

  new Notification(title, {
    body,
    icon: '/tradepro-icon.svg',
    badge: '/tradepro-icon.svg',
    tag: `price-alert-${alert.id}`,
    requireInteraction: true,
  });
}

/**
 * Play a short beep for alert notification.
 */
function playAlertSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.value = 0.3;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // AudioContext may not be available
  }
}

export function usePriceAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);

  // Ask for notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Listen for alert events on a dedicated message handler that piggybacks
  // on the existing MT5 WebSocket connection via the shared URL
  useEffect(() => {
    mountedRef.current = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connectWs() {
      if (!mountedRef.current) return;

      const ws = new WebSocket(MT5_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        // Fetch current alerts list
        ws.send(JSON.stringify({ action: 'list_alerts' }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (!mountedRef.current) return;

          switch (msg.type) {
            case 'alert_triggered': {
              const payload = msg.data as AlertTriggeredPayload;
              // Remove from local list
              setAlerts((prev) => prev.filter((a) => a.id !== payload.id));
              // Toast
              const dir = payload.direction === 'above' ? '▲' : '▼';
              toast.success(
                `${dir} ${payload.symbol} hit ${payload.triggeredPrice}`,
                {
                  description: payload.note || `Target: ${payload.targetPrice}`,
                  duration: 10000,
                },
              );
              // Native notification + sound
              fireNativeNotification(payload);
              playAlertSound();
              break;
            }
            case 'alert_created': {
              const created = msg.data as PriceAlert;
              setAlerts((prev) =>
                prev.some((a) => a.id === created.id) ? prev : [...prev, created],
              );
              break;
            }
            case 'alert_deleted':
              setAlerts((prev) => prev.filter((a) => a.id !== msg.data?.id));
              break;
            case 'alerts_list':
              setAlerts(msg.data as PriceAlert[]);
              break;
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (mountedRef.current) {
          reconnectTimer = setTimeout(connectWs, 5000);
        }
      };

      ws.onerror = () => {
        // onclose will fire after this
      };
    }

    // Small delay to survive React strict-mode double-mount teardown
    const initTimer = setTimeout(connectWs, 100);

    return () => {
      mountedRef.current = false;
      clearTimeout(initTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const createAlert = useCallback(
    async (symbol: string, targetPrice: number, direction?: 'above' | 'below', note?: string) => {
      // Use REST for reliable creation
      const res = await fetch(`${MT5_REST}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, targetPrice, direction, note }),
      });
      const json = await res.json();
      if (json.alert) {
        const newAlert = json.alert as PriceAlert;
        setAlerts((prev) =>
          prev.some((a) => a.id === newAlert.id) ? prev : [...prev, newAlert],
        );
      }
      return json.alert as PriceAlert;
    },
    [],
  );

  const deleteAlert = useCallback(async (id: string) => {
    await fetch(`${MT5_REST}/alerts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const updateAlert = useCallback(async (id: string, targetPrice: number, direction?: 'above' | 'below') => {
    const res = await fetch(`${MT5_REST}/alerts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPrice, direction }),
    });
    const json = await res.json();
    if (json.alert) {
      setAlerts((prev) => prev.map((a) => a.id === id ? json.alert : a));
    }
    return json.alert as PriceAlert;
  }, []);

  const refreshAlerts = useCallback(async () => {
    const res = await fetch(`${MT5_REST}/alerts`);
    const json = await res.json();
    setAlerts(json.alerts || []);
  }, []);

  return { alerts, createAlert, deleteAlert, updateAlert, refreshAlerts };
}
