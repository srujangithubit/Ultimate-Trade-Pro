export interface CandleFrame {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  index: number; // 0-based position in session candle array
}

export type ReplaySpeed = 1 | 2 | 5 | 10 | 'instant';

export type ReplayStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'completed'
  | 'error';

export interface ReplayState {
  sessionId: string;
  symbol: string;
  resolution: string;
  status: ReplayStatus;
  currentIndex: number;
  totalCandles: number;
  currentTime: number; // unix seconds of current candle
  balance: number;
  equity: number;
  unrealizedPnL: number;
  progress: number; // 0-1
  speedMultiplier: ReplaySpeed;
  error?: string;
}

export interface OpenPosition {
  id: string;
  side: 'buy' | 'sell';
  volume: number;
  entryPrice: number;
  entryTime: number; // unix seconds
  sl: number | null;
  tp: number | null;
  mae: number; // Maximum Adverse Excursion (pips)
  mfe: number; // Maximum Favorable Excursion (pips)
  unrealizedPnL: number;
}

export interface ReplayUpdate {
  sessionId: string;
  candle: CandleFrame;
  state: ReplayState;
  openPositions: OpenPosition[];
  triggeredSLTP: TriggeredSLTP[];
}

export interface TriggeredSLTP {
  positionId: string;
  type: 'sl' | 'tp';
  triggerPrice: number;
  candleTime: number;
}

export interface ReplayEngineOptions {
  sessionId: string;
  symbol: string;
  resolution: string;
  startingBalance: number;
  startIndex?: number; // resume from index (default 0)
  pipSize?: number; // auto-detected if not provided
}
