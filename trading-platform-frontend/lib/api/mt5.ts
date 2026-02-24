/**
 * MT5 REST API client - communicates with the MT5 Node server.
 */

const MT5_BASE = process.env.NEXT_PUBLIC_MT5_API_URL || 'http://localhost:3001';

/**
 * Dedicated axios-like fetcher for the MT5 Node server.
 * We use raw fetch here since the MT5 server is separate from the main backend.
 */
async function mt5Fetch(path: string, options?: RequestInit) {
  const res = await fetch(`${MT5_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'MT5 API Error');
  }
  return res.json();
}

export const mt5Api = {
  /** Connect to an MT5 account via the Python bridge */
  connect: async (server: string, login: number, password: string): Promise<{ success: boolean }> => {
    return mt5Fetch('/api/mt5/connect', {
      method: 'POST',
      body: JSON.stringify({ server, login, password }),
    });
  },

  /** Disconnect from MT5 */
  disconnect: async (): Promise<{ success: boolean }> => {
    return mt5Fetch('/api/mt5/disconnect', { method: 'POST' });
  },

  /** Get account info */
  getAccount: async () => {
    return mt5Fetch('/api/mt5/account');
  },

  /** Get open positions */
  getPositions: async () => {
    return mt5Fetch('/api/mt5/positions');
  },

  /** Get trade history */
  getHistory: async (days: number = 30) => {
    return mt5Fetch(`/api/mt5/history?days=${days}`);
  },

  /** Subscribe to symbol ticks */
  subscribe: async (symbol: string) => {
    return mt5Fetch('/api/mt5/subscribe', {
      method: 'POST',
      body: JSON.stringify({ symbol }),
    });
  },

  /** Unsubscribe from symbol ticks */
  unsubscribe: async (symbol: string) => {
    return mt5Fetch('/api/mt5/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ symbol }),
    });
  },

  /** Get connection status */
  getStatus: async (): Promise<{ connected: boolean; authenticated: boolean }> => {
    return mt5Fetch('/api/mt5/status');
  },

  /** Health check */
  health: async () => {
    return mt5Fetch('/health');
  },
};
