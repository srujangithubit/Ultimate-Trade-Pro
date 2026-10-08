/**
 * MT5 REST API client - communicates with the MT5 Node server.
 */

const MT5_BASE = process.env.NEXT_PUBLIC_MT5_API_URL || 'http://localhost:3001';
const MT5_INTERNAL_API_KEY = process.env.NEXT_PUBLIC_MT5_INTERNAL_API_KEY || '';

function getMt5InternalApiKey(): string {
  if (MT5_INTERNAL_API_KEY) {
    return MT5_INTERNAL_API_KEY;
  }

  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('mt5_internal_api_key') || '';
    if (stored) {
      return stored;
    }
  }

  return '';
}

/**
 * Dedicated axios-like fetcher for the MT5 Node server.
 * We use raw fetch here since the MT5 server is separate from the main backend.
 */
async function mt5Fetch(path: string, options?: RequestInit) {
  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const internalApiKey = getMt5InternalApiKey();
  if (internalApiKey) {
    headers.set('Authorization', `Bearer ${internalApiKey}`);
  }

  const res = await fetch(`${MT5_BASE}${path}`, {
    headers,
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

  /** Query account info for a specific MT5 login (password optional if terminal has cached credentials) */
  queryAccount: async (
    login: number,
    server: string,
    password?: string,
  ) => {
    const params = new URLSearchParams({
      server,
    });
    if (password) {
      params.set('password', password);
    }
    return mt5Fetch(`/api/mt5/account/${login}?${params.toString()}`);
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

  /** Place a market/limit/stop order */
  placeOrder: async (params: {
    symbol: string;
    direction: 'BUY' | 'SELL';
    volume: number;
    price?: number;
    sl?: number;
    tp?: number;
    slippage?: number;
    magic?: number;
    comment?: string;
  }): Promise<{ success: boolean; data?: Record<string, unknown> }> => {
    return mt5Fetch('/api/mt5/order', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  /** Close a position by ticket */
  closePosition: async (ticket: number, volume?: number): Promise<{ success: boolean; data?: Record<string, unknown> }> => {
    const params = new URLSearchParams();
    if (volume) params.set('volume', String(volume));
    const qs = params.toString();
    return mt5Fetch(`/api/mt5/order/${ticket}${qs ? `?${qs}` : ''}`, {
      method: 'DELETE',
    });
  },

  /** Modify SL/TP of an existing position */
  modifyPosition: async (ticket: number, sl?: number, tp?: number): Promise<{ success: boolean; data?: Record<string, unknown> }> => {
    return mt5Fetch(`/api/mt5/order/${ticket}`, {
      method: 'PATCH',
      body: JSON.stringify({ sl, tp }),
    });
  },

  /** Health check */
  health: async () => {
    return mt5Fetch('/health');
  },
};
