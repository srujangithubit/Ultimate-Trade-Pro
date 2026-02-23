import { create } from 'zustand';

interface Position {
    id: string;
    instrument: string;
    direction: 'LONG' | 'SHORT';
    entryPrice: number;
    quantity: number;
    currentPrice: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
    stopLoss: number;
    takeProfit: number;
    entryTime: string;
}

interface BacktestingState {
    currentSessionId: string | null;
    isPlaying: boolean;
    playbackSpeed: number;
    currentPrice: number;
    currentTimestamp: string | null;
    balance: number;
    startingBalance: number;
    pnl: number;
    positions: Position[];

    setSession: (sessionId: string) => void;
    setPlaying: (playing: boolean) => void;
    setPlaybackSpeed: (speed: number) => void;
    updatePrice: (price: number) => void;
    updateTimestamp: (timestamp: string) => void;
    updateBalance: (balance: number) => void;
    setPositions: (positions: Position[]) => void;
    addPosition: (position: Position) => void;
    removePosition: (positionId: string) => void;
    reset: () => void;
}

export const useBacktestingStore = create<BacktestingState>((set) => ({
    currentSessionId: null,
    isPlaying: false,
    playbackSpeed: 1,
    currentPrice: 0,
    currentTimestamp: null,
    balance: 50000,
    startingBalance: 50000,
    pnl: 0,
    positions: [],

    setSession: (sessionId) => set({ currentSessionId: sessionId }),
    setPlaying: (playing) => set({ isPlaying: playing }),
    setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
    updatePrice: (price) => set({ currentPrice: price }),
    updateTimestamp: (timestamp) => set({ currentTimestamp: timestamp }),
    updateBalance: (balance) =>
        set((state) => ({ balance, pnl: balance - state.startingBalance })),
    setPositions: (positions) => set({ positions }),
    addPosition: (position) =>
        set((state) => ({ positions: [...state.positions, position] })),
    removePosition: (positionId) =>
        set((state) => ({
            positions: state.positions.filter((p) => p.id !== positionId),
        })),
    reset: () =>
        set({
            isPlaying: false,
            playbackSpeed: 1,
            currentPrice: 0,
            currentTimestamp: null,
            positions: [],
        }),
}));
