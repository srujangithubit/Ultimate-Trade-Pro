/**
 * Shared event name constants for Socket.IO communication.
 * Used on both the gateway (server) and client side.
 */
export const MARKET_EVENTS = {
    // Client → Server
    SUBSCRIBE: 'subscribe',
    UNSUBSCRIBE: 'unsubscribe',
    PING: 'ping',

    // Server → Client
    CANDLE_UPDATE: 'candle:update',
    INDICATOR_UPDATE: 'indicator:update',
    TICK: 'tick',
    POSITION_UPDATE: 'position:update',
    ORDER_EVENT: 'order:event',
    RISK_UPDATE: 'risk:update',
    ACCOUNT_SNAPSHOT: 'account:snapshot',
    STRATEGY_LOG: 'strategy:log',
    PONG: 'pong',
} as const;

export type MarketEventName = (typeof MARKET_EVENTS)[keyof typeof MARKET_EVENTS];

/**
 * Available timeframes for candle aggregation.
 */
export type Timeframe = '1m' | '5m' | '15m' | '1h';

export const TIMEFRAME_MS: Record<Timeframe, number> = {
    '1m': 60_000,
    '5m': 300_000,
    '15m': 900_000,
    '1h': 3_600_000,
};

/**
 * Available trading symbols configuration.
 */
export interface SymbolConfig {
    symbol: string;
    displayName: string;
    pipSize: number;
    pipValue: number;
    minVolume: number;
    maxVolume: number;
    volumeStep: number;
    contractSize: number;
    currency: string;
}

export const TRADING_SYMBOLS: SymbolConfig[] = [
    { symbol: 'EURUSD', displayName: 'EUR/USD', pipSize: 0.0001, pipValue: 10, minVolume: 0.01, maxVolume: 100, volumeStep: 0.01, contractSize: 100000, currency: 'USD' },
    { symbol: 'GBPUSD', displayName: 'GBP/USD', pipSize: 0.0001, pipValue: 10, minVolume: 0.01, maxVolume: 100, volumeStep: 0.01, contractSize: 100000, currency: 'USD' },
    { symbol: 'USDJPY', displayName: 'USD/JPY', pipSize: 0.01, pipValue: 6.7, minVolume: 0.01, maxVolume: 100, volumeStep: 0.01, contractSize: 100000, currency: 'USD' },
    { symbol: 'XAUUSD', displayName: 'Gold', pipSize: 0.01, pipValue: 1, minVolume: 0.01, maxVolume: 50, volumeStep: 0.01, contractSize: 100, currency: 'USD' },
    { symbol: 'BTCUSD', displayName: 'BTC/USD', pipSize: 0.01, pipValue: 0.01, minVolume: 0.001, maxVolume: 10, volumeStep: 0.001, contractSize: 1, currency: 'USD' },
    { symbol: 'US500', displayName: 'S&P 500', pipSize: 0.1, pipValue: 1, minVolume: 0.1, maxVolume: 100, volumeStep: 0.1, contractSize: 10, currency: 'USD' },
    { symbol: 'NAS100', displayName: 'Nasdaq 100', pipSize: 0.1, pipValue: 1, minVolume: 0.1, maxVolume: 100, volumeStep: 0.1, contractSize: 10, currency: 'USD' },
    { symbol: 'EURGBP', displayName: 'EUR/GBP', pipSize: 0.0001, pipValue: 13, minVolume: 0.01, maxVolume: 100, volumeStep: 0.01, contractSize: 100000, currency: 'GBP' },
];
