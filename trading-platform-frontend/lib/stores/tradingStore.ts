'use client';

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
    Timeframe,
    ReplaySpeed,
    ReplayRange,
    Position,
    Order,
    RiskMetrics,
    AccountSnapshot,
    SignalMarker,
    TradeArrow,
} from '@/lib/types/trading';

// ─── Slice Interfaces ───────────────────────────────────────────────────────

interface SymbolSlice {
    activeSymbol: string;
    timeframe: Timeframe;
    setSymbol: (symbol: string) => void;
    setTimeframe: (tf: Timeframe) => void;
}

interface ReplaySlice {
    replayActive: boolean;
    replaySpeed: ReplaySpeed;
    replayTimestamp: number | null;
    replayRange: ReplayRange | null;
    toggleReplay: () => void;
    setReplaySpeed: (speed: ReplaySpeed) => void;
    setReplayTimestamp: (ts: number) => void;
    setReplayRange: (range: ReplayRange | null) => void;
}

interface PositionSlice {
    positions: Position[];
    upsertPosition: (p: Position) => void;
    removePosition: (id: string) => void;
}

interface OrderSlice {
    orders: Order[];
    upsertOrder: (o: Order) => void;
    cancelOrder: (id: string) => void;
}

interface RiskSlice {
    dailyDrawdown: number;
    maxRiskPerTrade: number;
    marginUsed: number;
    marginAvailable: number;
    setRiskMetrics: (metrics: RiskMetrics) => void;
}

interface AccountSlice {
    equity: number;
    balance: number;
    floatingPnL: number;
    updateAccount: (data: AccountSnapshot) => void;
}

interface CrosshairSlice {
    crosshairTime: number | null;
    setCrosshairTime: (t: number | null) => void;
}

interface StrategySlice {
    strategyEnabled: boolean;
    markers: SignalMarker[];
    tradeArrows: TradeArrow[];
    toggleStrategy: () => void;
    setMarkers: (m: SignalMarker[]) => void;
    setTradeArrows: (a: TradeArrow[]) => void;
}

// ─── Combined Store Type ────────────────────────────────────────────────────

export type TradingStore = SymbolSlice &
    ReplaySlice &
    PositionSlice &
    OrderSlice &
    RiskSlice &
    AccountSlice &
    CrosshairSlice &
    StrategySlice;

// ─── Store Implementation ───────────────────────────────────────────────────

export const useTradingStore = create<TradingStore>()(
    immer((set) => ({
        // ── Symbol Slice ──────────────────────────────────────────────────────
        activeSymbol: 'EURUSD',
        timeframe: '5m' as Timeframe,

        setSymbol: (symbol: string) =>
            set((state) => {
                state.activeSymbol = symbol;
            }),

        setTimeframe: (tf: Timeframe) =>
            set((state) => {
                state.timeframe = tf;
            }),

        // ── Replay Slice ──────────────────────────────────────────────────────
        replayActive: false,
        replaySpeed: 1 as ReplaySpeed,
        replayTimestamp: null,
        replayRange: null,

        toggleReplay: () =>
            set((state) => {
                state.replayActive = !state.replayActive;
                if (!state.replayActive) {
                    state.replayTimestamp = null;
                    state.replayRange = null;
                }
            }),

        setReplaySpeed: (speed: ReplaySpeed) =>
            set((state) => {
                state.replaySpeed = speed;
            }),

        setReplayTimestamp: (ts: number) =>
            set((state) => {
                state.replayTimestamp = ts;
            }),

        setReplayRange: (range: ReplayRange | null) =>
            set((state) => {
                state.replayRange = range;
            }),

        // ── Position Slice ────────────────────────────────────────────────────
        positions: [],

        upsertPosition: (p: Position) =>
            set((state) => {
                const idx = state.positions.findIndex((pos) => pos.id === p.id);
                if (idx >= 0) {
                    state.positions[idx] = p;
                } else {
                    state.positions.push(p);
                }
            }),

        removePosition: (id: string) =>
            set((state) => {
                state.positions = state.positions.filter((pos) => pos.id !== id);
            }),

        // ── Order Slice ───────────────────────────────────────────────────────
        orders: [],

        upsertOrder: (o: Order) =>
            set((state) => {
                const idx = state.orders.findIndex((ord) => ord.id === o.id);
                if (idx >= 0) {
                    state.orders[idx] = o;
                } else {
                    state.orders.push(o);
                }
            }),

        cancelOrder: (id: string) =>
            set((state) => {
                const order = state.orders.find((o) => o.id === id);
                if (order) {
                    order.status = 'cancelled';
                }
            }),

        // ── Risk Slice ────────────────────────────────────────────────────────
        dailyDrawdown: 0,
        maxRiskPerTrade: 0.02,
        marginUsed: 0,
        marginAvailable: 0,

        setRiskMetrics: (metrics: RiskMetrics) =>
            set((state) => {
                state.dailyDrawdown = metrics.dailyDrawdown;
                state.maxRiskPerTrade = metrics.maxRiskPerTrade;
                state.marginUsed = metrics.marginUsed;
                state.marginAvailable = metrics.marginAvailable;
            }),

        // ── Account Slice ─────────────────────────────────────────────────────
        equity: 0,
        balance: 0,
        floatingPnL: 0,

        updateAccount: (data: AccountSnapshot) =>
            set((state) => {
                state.equity = data.equity;
                state.balance = data.balance;
                state.floatingPnL = data.floatingPnL;
            }),

        // ── Crosshair Slice ───────────────────────────────────────────────────
        crosshairTime: null,

        setCrosshairTime: (t: number | null) =>
            set((state) => {
                state.crosshairTime = t;
            }),

        // ── Strategy Slice ────────────────────────────────────────────────────
        strategyEnabled: false,
        markers: [],
        tradeArrows: [],

        toggleStrategy: () =>
            set((state) => {
                state.strategyEnabled = !state.strategyEnabled;
            }),

        setMarkers: (m: SignalMarker[]) =>
            set((state) => {
                state.markers = m;
            }),

        setTradeArrows: (a: TradeArrow[]) =>
            set((state) => {
                state.tradeArrows = a;
            }),
    }))
);
