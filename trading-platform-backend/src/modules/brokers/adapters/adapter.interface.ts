/**
 * Standardized trade representation across all broker integrations.
 */
export interface NormalizedTrade {
  externalId: string;
  instrument: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  commission?: number;
  fees?: number;
  pnl?: number;
  entryTimestamp: Date;
  exitTimestamp?: Date;
  status: 'open' | 'closed' | 'partial';
  rawData?: Record<string, any>;
}

/**
 * Standardized position representation.
 */
export interface NormalizedPosition {
  instrument: string;
  side: 'long' | 'short';
  quantity: number;
  averageEntryPrice: number;
  currentPrice?: number;
  unrealizedPnl?: number;
  marketValue?: number;
}

/**
 * Standardized account information.
 */
export interface AccountInfo {
  accountId: string;
  currency: string;
  balance: number;
  buyingPower?: number;
  equity?: number;
  marginUsed?: number;
  status: string;
}

/**
 * Order request passed to placeOrder.
 */
export interface OrderRequest {
  instrument: string;
  side: 'buy' | 'sell';
  quantity: number;
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  limitPrice?: number;
  stopPrice?: number;
  timeInForce?: 'day' | 'gtc' | 'ioc' | 'fok';
}

/**
 * Order response from placeOrder.
 */
export interface OrderResponse {
  orderId: string;
  status: 'pending' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected';
  filledQuantity?: number;
  filledPrice?: number;
  message?: string;
}

/**
 * Broker authentication credentials.
 */
export interface BrokerCredentials {
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  accountId?: string;
  [key: string]: any;
}

/**
 * Authentication result returned after successful authentication.
 */
export interface AuthResult {
  authenticated: boolean;
  accountId?: string;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Interface that all broker adapters must implement.
 */
export interface BrokerAdapter {
  /** Unique broker identifier */
  readonly brokerId: string;

  /** Human-readable name */
  readonly brokerName: string;

  /** Authenticate with the broker */
  authenticate(credentials: BrokerCredentials): Promise<AuthResult>;

  /** Disconnect / cleanup */
  disconnect(): Promise<void>;

  /** Fetch trades for a date range */
  fetchTrades(startDate: Date, endDate: Date): Promise<NormalizedTrade[]>;

  /** Get current open positions */
  getPositions(): Promise<NormalizedPosition[]>;

  /** Get account information */
  getAccountInfo(): Promise<AccountInfo>;

  /** Place an order */
  placeOrder(order: OrderRequest): Promise<OrderResponse>;

  /** Cancel an existing order */
  cancelOrder(orderId: string): Promise<{ success: boolean; message?: string }>;
}
