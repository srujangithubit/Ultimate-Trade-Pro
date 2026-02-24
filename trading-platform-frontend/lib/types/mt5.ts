/**
 * MT5 TypeScript type definitions for the trading platform.
 */

export interface MT5Credentials {
  server: string;
  login: number;
  password: string;
}

export interface MT5AccountInfo {
  login: number;
  server: string;
  balance: number;
  equity: number;
  margin: number;
  free_margin: number;
  leverage: number;
  currency: string;
  name: string;
}

export interface MT5TradePosition {
  ticket: number;
  symbol: string;
  type: number;
  type_str: 'BUY' | 'SELL';
  volume: number;
  price_open: number;
  price_current: number;
  profit: number;
  swap: number;
  sl: number;
  tp: number;
  time: number;
  magic: number;
  comment: string;
}

export interface MT5TickData {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  time: string;
}

export interface MT5ClosedTrade {
  ticket_in: number;
  ticket_out: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  entry_price: number;
  exit_price: number;
  entry_time: number;
  exit_time: number;
  profit: number;
  swap: number;
  commission: number;
  fee: number;
  comment: string;
  magic: number;
}

export interface MT5ConnectionStatus {
  connected: boolean;
  authenticated: boolean;
}

export interface MT5WebSocketMessage {
  type:
    | 'tick'
    | 'account_info'
    | 'positions'
    | 'trade_history'
    | 'auth'
    | 'subscribed'
    | 'heartbeat'
    | 'status'
    | 'error'
    | 'mt5_error';
  data?: unknown;
  symbol?: string;
  message?: string;
  connected?: boolean;
  authenticated?: boolean;
}

export interface MT5ContextValue {
  status: MT5ConnectionStatus;
  account: MT5AccountInfo | null;
  positions: MT5TradePosition[];
  tradeHistory: MT5ClosedTrade[];
  ticks: Record<string, MT5TickData>;
  isConnecting: boolean;
  error: string | null;
  connect: (credentials: MT5Credentials) => Promise<boolean>;
  disconnect: () => void;
  subscribe: (symbol: string) => void;
  unsubscribe: (symbol: string) => void;
  refreshAccount: () => void;
  refreshPositions: () => void;
  refreshTradeHistory: (days?: number) => void;
}
