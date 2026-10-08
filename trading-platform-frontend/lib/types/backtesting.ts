export type BacktestStatus = 'created' | 'running' | 'paused' | 'completed';
export type TradeSide = 'buy' | 'sell';
export type TradeStatus = 'open' | 'closed' | 'cancelled';
export type ExitReason = 'manual' | 'sl' | 'tp' | 'session_end';
export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
export type ReplaySpeed = 1 | 2 | 5 | 10 | 'instant';

export interface BacktestCandle {
    time: number; // unix seconds
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface BacktestSession {
    id: string;
    userId: string;
    accountId?: string | null;
    instrument: string;
    timeframe: Timeframe;
    timezone?: string;
    startDate: string;
    endDate: string;
    startingBalance: number;
    currentBalance: number;
    replayIndex: number;
    status: BacktestStatus;
    totalCandles: number;
    config: SessionConfig;
    createdAt: string;
    trades?: BacktestSessionTrade[];
}

export interface BacktestSessionTrade {
    id: string;
    symbol: string;
    direction: string;
    entryDate: string;
    exitDate: string | null;
    entryPrice: number;
    exitPrice: number | null;
    quantity: number;
    stopLoss: number | null;
    takeProfit: number | null;
    pnlGross: number | null;
    pnlNet: number | null;
    status: string;
}

export interface SessionConfig {
    commission: number; // USD per lot
    slippage: number; // pips
    spread: number; // pips
    initialBalance: number;
}

export interface BacktestTrade {
    id: string;
    backtestSessionId: string;
    instrument: string;
    side: TradeSide;
    volume: number;
    entryPrice: number;
    exitPrice: number | null;
    entryTime: string;
    exitTime: string | null;
    sl: number | null;
    tp: number | null;
    status: TradeStatus;
    pnlGross: number;
    pnlNet: number;
    commission: number;
    mae: number;
    mfe: number;
    holdingPeriodSeconds: number;
    exitReason: ExitReason | null;
    /** Engine alias fields — present on live positions from the engine */
    direction?: string;
    quantity?: number;
    stopLoss?: number | null;
    takeProfit?: number | null;
    unrealizedPnL?: number;
}

export interface CreateSessionDto {
    sessionName: string;
    instrument: string;
    assetClass?: string;
    timeframe: Timeframe;
    timezone?: string;
    startDate: string;
    endDate: string;
    startingBalance: number;
    playbookId?: string;
    config: SessionConfig;
}

export interface CreateOrderDto {
    orderType: 'market' | 'limit' | 'stop';
    direction: string;
    quantity: number;
    price?: number;
    stopPrice?: number;
    sl?: number;
    tp?: number;
}

export interface BacktestUpdate {
    sessionId: string;
    replayIndex: number;
    candle: BacktestCandle;
    currentPrice: number;
    balance: number;
    equity: number;
    pnl: number;
    openTrades: BacktestTrade[];
    progress: number; // 0-1
}

export interface EquityCurvePoint {
    time: string; // ISO date string
    equity: number;
    balance: number;
    drawdown: number; // percentage 0-100
    drawdownAbs: number; // absolute dollar value
    tradeCount: number;
}

export interface PerformanceReport {
    sessionId: string;
    instrument: string;
    timeframe: Timeframe;
    startDate: string;
    endDate: string;
    startingBalance: number;
    finalBalance: number;
    netPnL: number;
    grossPnL: number;
    totalCommission: number;
    returnPct: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    breakEvenTrades: number;
    winRate: number; // 0-1
    lossRate: number; // 0-1
    avgWin: number;
    avgLoss: number;
    largestWin: number;
    largestLoss: number;
    avgHoldingPeriodSeconds: number;
    maxConsecutiveWins: number;
    maxConsecutiveLosses: number;
    profitFactor: number; // grossProfit / grossLoss
    expectancy: number; // (winRate * avgWin) - (lossRate * avgLoss)
    sharpeRatio: number; // annualized
    sortinoRatio: number; // annualized, downside deviation only
    maxDrawdown: number; // percentage
    maxDrawdownAbs: number; // dollar amount
    maxDrawdownDuration: number; // seconds
    calmarRatio: number; // annualReturn / maxDrawdown
    recoveryFactor: number; // netPnL / maxDrawdownAbs
    payoffRatio: number; // avgWin / avgLoss
    equityCurve: EquityCurvePoint[];
    monthlyReturns: MonthlyReturn[];
    tradeDistribution: TradeDistributionBucket[];
    longTrades: TradeDirectionStats;
    shortTrades: TradeDirectionStats;
}

export interface MonthlyReturn {
    month: string; // 'YYYY-MM'
    return: number; // percentage
    trades: number;
    pnl: number;
}

export interface TradeDistributionBucket {
    label: string; // e.g. '-5% to -4%'
    count: number;
    percentage: number;
}

export interface TradeDirectionStats {
    total: number;
    wins: number;
    losses: number;
    winRate: number;
    avgPnL: number;
    totalPnL: number;
}

export const BACKTEST_EVENTS = {
    SUBSCRIBE: 'backtest:subscribe',
    UPDATE: 'backtest:update',
    PLAY: 'backtest:play',
    PAUSE: 'backtest:pause',
    SEEK: 'backtest:seek',
    SPEED: 'backtest:speed',
    ORDER: 'backtest:order',
    CLOSE_TRADE: 'backtest:close_trade',
    CHANGE_TIMEFRAME: 'backtest:change_timeframe',
    ERROR: 'backtest:error',
    COMPLETED: 'backtest:completed',
    STATE_SYNC: 'backtest:state_sync',
} as const;
