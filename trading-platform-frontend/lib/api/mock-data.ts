// ────────────────────────────────────────
// Mock Data for UI Development
// ────────────────────────────────────────

export const mockUser = {
    id: 'usr_1',
    firstName: 'Alex',
    lastName: 'Trader',
    email: 'alex@traderplatform.io',
    avatar: null,
    plan: 'Pro',
    createdAt: '2025-01-15T10:00:00Z',
};

export const mockOverviewStats = {
    totalPnL: 12450.75,
    totalPnLPercent: 24.9,
    winRate: 62.5,
    totalTrades: 148,
    bestTrade: 3200.0,
    worstTrade: -1450.0,
    averageRR: 2.3,
    profitFactor: 1.85,
    sharpeRatio: 1.42,
    maxDrawdown: -8.2,
};

export const mockRecentTrades = [
    {
        id: 'trd_1',
        instrument: 'AAPL',
        direction: 'LONG' as const,
        entryPrice: 178.5,
        exitPrice: 185.2,
        quantity: 100,
        pnl: 670.0,
        pnlPercent: 3.75,
        entryDate: '2025-02-10T14:30:00Z',
        exitDate: '2025-02-12T15:45:00Z',
        setup: 'Breakout',
        tags: ['momentum', 'earnings'],
    },
    {
        id: 'trd_2',
        instrument: 'TSLA',
        direction: 'SHORT' as const,
        entryPrice: 245.0,
        exitPrice: 238.5,
        quantity: 50,
        pnl: 325.0,
        pnlPercent: 2.65,
        entryDate: '2025-02-09T10:15:00Z',
        exitDate: '2025-02-09T14:30:00Z',
        setup: 'Mean Reversion',
        tags: ['overextended'],
    },
    {
        id: 'trd_3',
        instrument: 'MSFT',
        direction: 'LONG' as const,
        entryPrice: 415.0,
        exitPrice: 410.2,
        quantity: 30,
        pnl: -144.0,
        pnlPercent: -1.16,
        entryDate: '2025-02-08T11:00:00Z',
        exitDate: '2025-02-08T15:00:00Z',
        setup: 'Pullback',
        tags: ['support-bounce'],
    },
    {
        id: 'trd_4',
        instrument: 'NVDA',
        direction: 'LONG' as const,
        entryPrice: 720.0,
        exitPrice: 745.0,
        quantity: 20,
        pnl: 500.0,
        pnlPercent: 3.47,
        entryDate: '2025-02-07T09:30:00Z',
        exitDate: '2025-02-07T15:55:00Z',
        setup: 'Gap & Go',
        tags: ['gap-up', 'momentum'],
    },
    {
        id: 'trd_5',
        instrument: 'SPY',
        direction: 'SHORT' as const,
        entryPrice: 498.0,
        exitPrice: 501.5,
        quantity: 200,
        pnl: -700.0,
        pnlPercent: -0.7,
        entryDate: '2025-02-06T13:00:00Z',
        exitDate: '2025-02-06T15:30:00Z',
        setup: 'Reversal',
        tags: ['counter-trend'],
    },
];

export const mockBacktestingSessions = [
    {
        id: 'bts_1',
        name: 'ES Futures Strategy - Feb 2025',
        instrument: 'ES',
        timeframe: '5m',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        startingBalance: 50000,
        currentBalance: 53200,
        status: 'active' as const,
        totalTrades: 23,
        winRate: 65.2,
        pnl: 3200,
        createdAt: '2025-02-10T08:00:00Z',
    },
    {
        id: 'bts_2',
        name: 'NQ Breakout Strategy',
        instrument: 'NQ',
        timeframe: '15m',
        startDate: '2025-01-15',
        endDate: '2025-02-15',
        startingBalance: 100000,
        currentBalance: 107500,
        status: 'completed' as const,
        totalTrades: 45,
        winRate: 58.0,
        pnl: 7500,
        createdAt: '2025-02-05T10:00:00Z',
    },
    {
        id: 'bts_3',
        name: 'AAPL Swing Strategy',
        instrument: 'AAPL',
        timeframe: '1D',
        startDate: '2024-12-01',
        endDate: '2025-01-31',
        startingBalance: 25000,
        currentBalance: 23800,
        status: 'paused' as const,
        totalTrades: 12,
        winRate: 41.7,
        pnl: -1200,
        createdAt: '2025-01-20T14:00:00Z',
    },
];

export const mockPositions = [
    {
        id: 'pos_1',
        instrument: 'ES',
        direction: 'LONG' as const,
        entryPrice: 5025.0,
        quantity: 2,
        currentPrice: 5038.5,
        unrealizedPnl: 675.0,
        unrealizedPnlPercent: 0.27,
        stopLoss: 5010.0,
        takeProfit: 5060.0,
        entryTime: '2025-02-10T14:30:00Z',
    },
    {
        id: 'pos_2',
        instrument: 'ES',
        direction: 'SHORT' as const,
        entryPrice: 5045.0,
        quantity: 1,
        currentPrice: 5038.5,
        unrealizedPnl: 325.0,
        unrealizedPnlPercent: 0.13,
        stopLoss: 5060.0,
        takeProfit: 5020.0,
        entryTime: '2025-02-10T15:00:00Z',
    },
];

export const mockCandlestickData = generateCandlestickData();

function generateCandlestickData() {
    const data = [];
    let price = 5000;
    const startDate = new Date('2025-01-01');

    for (let i = 0; i < 200; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);

        const open = price + (Math.random() - 0.5) * 20;
        const close = open + (Math.random() - 0.5) * 30;
        const high = Math.max(open, close) + Math.random() * 15;
        const low = Math.min(open, close) - Math.random() * 15;
        const volume = Math.floor(50000 + Math.random() * 100000);

        data.push({
            time: date.toISOString().split('T')[0],
            open: parseFloat(open.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            close: parseFloat(close.toFixed(2)),
            volume,
        });

        price = close;
    }

    return data;
}

export const mockEquityCurveData = generateEquityCurveData();

function generateEquityCurveData() {
    const data = [];
    let equity = 50000;
    const startDate = new Date('2025-01-01');

    for (let i = 0; i < 90; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);

        const dailyReturn = (Math.random() - 0.45) * 800;
        equity += dailyReturn;

        data.push({
            date: date.toISOString().split('T')[0],
            equity: parseFloat(equity.toFixed(2)),
            dailyPnl: parseFloat(dailyReturn.toFixed(2)),
            drawdown: parseFloat((Math.min(0, (Math.random() - 0.6) * 5)).toFixed(2)),
        });
    }

    return data;
}

export const mockCalendarData = generateCalendarData();

function generateCalendarData() {
    const data: Record<string, number> = {};
    const startDate = new Date('2025-01-01');

    for (let i = 0; i < 60; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const key = date.toISOString().split('T')[0];

        // Skip weekends
        if (date.getDay() === 0 || date.getDay() === 6) continue;

        // Random P&L for the day
        data[key] = parseFloat(((Math.random() - 0.4) * 2000).toFixed(2));
    }

    return data;
}

export const mockPlaybooks = [
    {
        id: 'pb_1',
        name: 'Morning Breakout',
        description: 'Trade breakouts from the opening range within the first 30 minutes of market open.',
        rules: [
            'Wait for first 15-min candle to close',
            'Enter on break above/below the range with volume confirmation',
            'Stop loss at opposite end of the range',
            'Target 2:1 risk-reward minimum',
        ],
        winRate: 68.5,
        avgRR: 2.4,
        totalTrades: 42,
        tags: ['momentum', 'breakout', 'intraday'],
        createdAt: '2025-01-05T10:00:00Z',
    },
    {
        id: 'pb_2',
        name: 'VWAP Mean Reversion',
        description: 'Fade extended moves away from VWAP with confirmation candles.',
        rules: [
            'Wait for price to be 2+ ATR from VWAP',
            'Look for rejection candle pattern',
            'Enter on close of rejection candle',
            'Stop above/below the extreme',
            'Target VWAP for first take-profit',
        ],
        winRate: 55.0,
        avgRR: 1.8,
        totalTrades: 31,
        tags: ['mean-reversion', 'vwap', 'intraday'],
        createdAt: '2025-01-12T14:00:00Z',
    },
    {
        id: 'pb_3',
        name: 'Gap & Go',
        description: 'Trade stocks gapping up on high relative volume with catalyst.',
        rules: [
            'Pre-market gap > 4% with catalyst',
            'Relative volume > 3x',
            'Enter on first pullback to VWAP or prior resistance turned support',
            'Trail stop using 5-min moving average',
        ],
        winRate: 72.0,
        avgRR: 3.1,
        totalTrades: 18,
        tags: ['gap', 'momentum', 'catalyst'],
        createdAt: '2025-01-20T09:00:00Z',
    },
];

export const mockWinRateBySetup = [
    { setup: 'Breakout', wins: 28, losses: 14, winRate: 66.7 },
    { setup: 'Mean Reversion', wins: 17, losses: 14, winRate: 54.8 },
    { setup: 'Gap & Go', wins: 13, losses: 5, winRate: 72.2 },
    { setup: 'Pullback', wins: 15, losses: 10, winRate: 60.0 },
    { setup: 'Reversal', wins: 8, losses: 12, winRate: 40.0 },
];
