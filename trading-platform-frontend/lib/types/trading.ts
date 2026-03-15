/**
 * TradePro Charts — Core Trading Type Definitions
 * Institutional-grade type system for the trading terminal.
 */

// ─── Enums & Literal Types ──────────────────────────────────────────────────

export type Timeframe = '1m' | '5m' | '15m' | '1h';

export type OrderSide = 'buy' | 'sell';

export type OrderType = 'market' | 'limit' | 'stop';

export type OrderStatus =
    | 'pending'
    | 'filled'
    | 'partially_filled'
    | 'cancelled'
    | 'rejected'
    | 'expired';

// ─── Market Data ────────────────────────────────────────────────────────────

export interface Tick {
    symbol: string;
    bid: string;
    ask: string;
    last: string;
    volume: string;
    timestamp: number;
}

export interface Candle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

// ─── Indicators ─────────────────────────────────────────────────────────────

export interface IndicatorUpdate {
    symbol: string;
    timeframe: Timeframe;
    time: number;
    ema9: number | null;
    ema21: number | null;
    ema50: number | null;
    rsi: number | null;
    vwap: number | null;
    atr: number | null;
}

export interface RSIState {
    period: number;
    prevClose: number | null;
    avgGain: number;
    avgLoss: number;
    count: number;
}

export interface ATRState {
    period: number;
    prevCandle: Candle | null;
    atrValues: number[];
    currentATR: number;
    count: number;
}

export interface VWAPState {
    cumulativeTPV: number;
    cumulativeVolume: number;
    sessionDate: string | null;
}

// ─── Positions & Orders ─────────────────────────────────────────────────────

export interface Position {
    id: string;
    accountId: string;
    symbol: string;
    side: OrderSide;
    volume: number;
    openPrice: number;
    currentPrice: number;
    sl: number | null;
    tp: number | null;
    pnl: number;
    openedAt: string;
    closedAt: string | null;
}

export interface Order {
    id: string;
    accountId: string;
    symbol: string;
    side: OrderSide;
    type: OrderType;
    volume: number;
    price: number | null;
    sl: number | null;
    tp: number | null;
    status: OrderStatus;
    filledAt: string | null;
    createdAt: string;
}

// ─── Risk ───────────────────────────────────────────────────────────────────

export interface RiskMetrics {
    dailyDrawdown: number;
    maxRiskPerTrade: number;
    marginUsed: number;
    marginAvailable: number;
}

export interface RiskValidationResult {
    valid: boolean;
    reason: string | null;
    riskAmount: number;
    marginRequired: number;
}

// ─── Account ────────────────────────────────────────────────────────────────

export interface AccountSnapshot {
    equity: number;
    balance: number;
    floatingPnL: number;
    currency: string;
}

// ─── Strategy & Visualization ───────────────────────────────────────────────

export interface SignalMarker {
    time: number;
    position: 'aboveBar' | 'belowBar';
    color: string;
    shape: 'arrowUp' | 'arrowDown' | 'circle' | 'square';
    text: string;
}

export interface TradeArrow {
    time: number;
    price: number;
    side: OrderSide;
    label: string;
}

// ─── Performance & Analytics ────────────────────────────────────────────────

export interface EquityCurvePoint {
    date: string;
    equity: number;
    drawdown: number;
    benchmark: number;
}

export interface PerformanceStats {
    netPnl: number;
    winRate: number;
    maxDrawdown: number;
    sharpeRatio: number;
    profitFactor: number;
    expectancy: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    avgWin: number;
    avgLoss: number;
}

// ─── Replay ─────────────────────────────────────────────────────────────────

export interface ReplayRange {
    from: number;
    to: number;
}

export type ReplaySpeed = 1 | 5 | 'instant';

// ─── Socket Event Names (shared between client/server) ─────────────────────

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

// ─── Connection Status ──────────────────────────────────────────────────────

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// ─── Symbol Config ──────────────────────────────────────────────────────────

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
