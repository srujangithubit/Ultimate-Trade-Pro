/**
 * Standardized OHLCV candle data.
 */
export interface OHLCV {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Realtime quote data.
 */
export interface Quote {
  symbol: string;
  price: number;
  bid?: number;
  ask?: number;
  volume?: number;
  timestamp: Date;
}

/**
 * Available timeframes for historical data.
 */
export type Timeframe =
  | '1m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '4h'
  | '1d'
  | '1w'
  | '1M';

/**
 * Symbol search result.
 */
export interface SymbolInfo {
  symbol: string;
  name: string;
  type: 'stock' | 'etf' | 'crypto' | 'forex' | 'option' | 'future';
  exchange?: string;
  currency?: string;
}

/**
 * Interface that all market data providers must implement.
 */
export interface MarketDataProvider {
  /** Unique provider identifier */
  readonly providerId: string;

  /** Human-readable name */
  readonly providerName: string;

  /** Priority (lower = higher priority for fallback chain) */
  readonly priority: number;

  /** Fetch historical OHLCV data */
  getHistoricalData(
    symbol: string,
    from: Date,
    to: Date,
    timeframe: Timeframe,
  ): Promise<OHLCV[]>;

  /** Get a realtime or near-realtime quote */
  getRealtimeQuote(symbol: string): Promise<Quote>;

  /** Search for available symbols */
  searchSymbols(query: string): Promise<SymbolInfo[]>;

  /** Check if the provider supports a given symbol */
  supportsSymbol(symbol: string): Promise<boolean>;
}
