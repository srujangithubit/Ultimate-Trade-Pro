import {
  CandleFrame,
  ReplaySpeed,
  ReplayStatus,
  ReplayState,
  OpenPosition,
  ReplayUpdate,
  TriggeredSLTP,
  ReplayEngineOptions,
} from '../types/replay.types';

/**
 * Pure TypeScript replay engine — NO NestJS dependencies.
 * Instantiated per session by the backtesting service/gateway.
 * Operates entirely on the in-memory CandleFrame[] array.
 */
export class ReplayEngine {
  private readonly intrabarMode: 'worst_case' = 'worst_case';
  private candles: CandleFrame[];
  private currentIndex: number;
  private balance: number;
  private startingBalance: number;
  private openPositions: Map<string, OpenPosition>;
  private speed: ReplaySpeed;
  private status: ReplayStatus;
  private intervalId: ReturnType<typeof setInterval> | null;
  private immediateHandle: ReturnType<typeof setImmediate> | null;
  private onUpdateCallback: ((update: ReplayUpdate) => void) | null;
  private onCompleteCallback: ((finalState: ReplayState) => void) | null;
  private onErrorCallback: ((error: Error) => void) | null;
  private readonly pipSize: number;
  private readonly contractSize: number;
  private readonly sessionId: string;
  private readonly symbol: string;
  private readonly resolution: string;
  /** Time of the last candle that was processed and emitted via onUpdate.
   *  External callers (e.g. executeOrder) should use this to get the
   *  candle time visible on the user's chart, since currentIndex may
   *  already point to the NEXT candle after tick(). */
  private lastProcessedTime: number;

  constructor(options: ReplayEngineOptions, candles: CandleFrame[]) {
    this.sessionId = options.sessionId;
    this.symbol = options.symbol;
    this.resolution = options.resolution;
    this.candles = candles;
    this.currentIndex = options.startIndex ?? 0;
    this.balance = options.startingBalance;
    this.startingBalance = options.startingBalance;
    this.openPositions = new Map();
    this.speed = 1;
    this.status = 'ready';
    this.intervalId = null;
    this.immediateHandle = null;
    this.onUpdateCallback = null;
    this.onCompleteCallback = null;
    this.onErrorCallback = null;
    this.pipSize = options.pipSize ?? this.detectPipSize(options.symbol);
    this.contractSize = this.detectContractSize(options.symbol);
    // Initialise lastProcessedTime from the candle at startIndex (if any)
    this.lastProcessedTime = this.candles[this.currentIndex]?.time ?? 0;
  }

  private detectPipSize(symbol: string): number {
    if (symbol.includes('JPY')) return 0.01;
    if (symbol === 'XAUUSD') return 0.1;
    if (
      symbol.includes('BTC') ||
      symbol.includes('ETH') ||
      symbol.includes('XBT')
    )
      return 1.0;
    if (
      symbol.includes('US30') ||
      symbol.includes('NAS') ||
      symbol.includes('SPX')
    )
      return 0.1;
    return 0.0001;
  }

  private detectContractSize(symbol: string): number {
    const sym = symbol.toUpperCase();
    if (sym === 'XAUUSD') return 100;
    if (sym === 'XAGUSD') return 5000;
    if (sym.includes('BTC') || sym.includes('XBT')) return 1;
    if (sym.includes('ETH')) return 1;
    if (sym.includes('US30')) return 1;
    if (sym.includes('US500') || sym.includes('SPX')) return 50;
    if (sym.includes('NAS')) return 20;
    return 100_000; // standard forex lot
  }

  // Event registration
  onUpdate(callback: (update: ReplayUpdate) => void): this {
    this.onUpdateCallback = callback;
    return this;
  }

  onComplete(callback: (finalState: ReplayState) => void): this {
    this.onCompleteCallback = callback;
    return this;
  }

  onError(callback: (error: Error) => void): this {
    this.onErrorCallback = callback;
    return this;
  }

  play(): void {
    if (this.status === 'completed') return;
    if (this.status === 'playing') return;
    if (this.currentIndex >= this.candles.length) {
      this.complete();
      return;
    }

    this.status = 'playing';

    if (this.speed === 'instant') {
      this.runInstant();
      return;
    }

    const intervalMs = this.getIntervalMs();
    this.intervalId = setInterval(() => {
      if (this.currentIndex >= this.candles.length) {
        this.stopInterval();
        this.complete();
        return;
      }
      this.tick();
    }, intervalMs);
  }

  private runInstant(): void {
    // Process in batches of 500 via setImmediate to avoid blocking event loop
    const BATCH = 500;
    const processBatch = () => {
      const end = Math.min(this.currentIndex + BATCH, this.candles.length);
      while (this.currentIndex < end) {
        this.tick();
      }
      if (this.currentIndex >= this.candles.length) {
        this.complete();
        return;
      }
      this.immediateHandle = setImmediate(processBatch);
    };
    this.immediateHandle = setImmediate(processBatch);
  }

  pause(): void {
    this.stopInterval();
    if (this.status === 'playing') this.status = 'paused';
  }

  seek(targetIndex: number): void {
    const wasPlaying = this.status === 'playing';
    this.stopInterval();

    const safeIndex = Math.max(
      0,
      Math.min(targetIndex, this.candles.length - 1),
    );

    // Full state reset
    this.currentIndex = 0;
    this.balance = this.startingBalance;
    this.openPositions.clear();

    // Fast-forward without emitting updates (silent replay up to target)
    while (this.currentIndex < safeIndex) {
      this.processCandle(this.candles[this.currentIndex], false);
      this.currentIndex++;
    }

    this.status = 'paused';

    // Emit current state after seek
    if (this.candles[this.currentIndex]) {
      this.lastProcessedTime = this.candles[this.currentIndex].time;
      const update = this.buildUpdate(this.candles[this.currentIndex], []);
      this.onUpdateCallback?.(update);
    }

    if (wasPlaying) this.play();
  }

  setSpeed(speed: ReplaySpeed): void {
    this.speed = speed;
    if (this.status === 'playing') {
      this.stopInterval();
      // Reset status so play() doesn't bail out with "already playing"
      this.status = 'paused';
      this.play();
    }
  }

  addPosition(position: OpenPosition): void {
    this.openPositions.set(position.id, { ...position });
  }

  closePosition(positionId: string, closePrice: number): number {
    const pos = this.openPositions.get(positionId);
    if (!pos) return 0;
    const pnl = this.calculatePnL(pos, closePrice);
    this.balance += pnl;
    this.openPositions.delete(positionId);
    return pnl;
  }

  getState(): ReplayState {
    // For external callers (e.g. executeOrder), use lastProcessedTime
    // which represents the candle visible on the user's chart.
    // currentIndex may already point to the next tick.
    const currentCandle =
      this.candles[this.currentIndex] ?? this.candles[this.candles.length - 1];
    const unrealizedPnL = this.calculateTotalUnrealizedPnL(
      currentCandle?.close ?? 0,
    );
    return {
      sessionId: this.sessionId,
      symbol: this.symbol,
      resolution: this.resolution,
      status: this.status,
      currentIndex: this.currentIndex,
      totalCandles: this.candles.length,
      currentTime: this.lastProcessedTime || currentCandle?.time || 0,
      balance: this.balance,
      equity: this.balance + unrealizedPnL,
      unrealizedPnL,
      progress:
        this.candles.length > 0 ? this.currentIndex / this.candles.length : 0,
      speedMultiplier: this.speed,
    };
  }

  getCandleSlice(fromIndex: number, toIndex: number): CandleFrame[] {
    return this.candles.slice(fromIndex, toIndex);
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }
  getTotalCandles(): number {
    return this.candles.length;
  }
  getStatus(): ReplayStatus {
    return this.status;
  }

  private tick(): void {
    const candle = this.candles[this.currentIndex];
    if (!candle) return;
    const triggeredSLTP = this.processCandle(candle, true);
    const update = this.buildUpdate(candle, triggeredSLTP);
    this.lastProcessedTime = candle.time;
    this.onUpdateCallback?.(update);
    this.currentIndex++;
  }

  private processCandle(
    candle: CandleFrame,
    updateMAEMFE: boolean,
  ): TriggeredSLTP[] {
    const triggered: TriggeredSLTP[] = [];

    for (const [id, pos] of this.openPositions) {
      // Check SL/TP triggers
      if (pos.side === 'buy') {
        const slHit = pos.sl !== null && candle.low <= pos.sl;
        const tpHit = pos.tp !== null && candle.high >= pos.tp;

        if (slHit && tpHit && this.intrabarMode === 'worst_case') {
          triggered.push({
            positionId: id,
            type: 'sl',
            triggerPrice: pos.sl!,
            candleTime: candle.time,
          });
          const pnl = this.calculatePnL(pos, pos.sl!);
          this.balance += pnl;
          this.openPositions.delete(id);
          continue;
        }

        if (slHit) {
          triggered.push({
            positionId: id,
            type: 'sl',
            triggerPrice: pos.sl!,
            candleTime: candle.time,
          });
          const pnl = this.calculatePnL(pos, pos.sl!);
          this.balance += pnl;
          this.openPositions.delete(id);
          continue;
        }
        if (tpHit) {
          triggered.push({
            positionId: id,
            type: 'tp',
            triggerPrice: pos.tp!,
            candleTime: candle.time,
          });
          const pnl = this.calculatePnL(pos, pos.tp!);
          this.balance += pnl;
          this.openPositions.delete(id);
          continue;
        }
        if (updateMAEMFE) {
          const adverse = (pos.entryPrice - candle.low) / this.pipSize;
          const favorable = (candle.high - pos.entryPrice) / this.pipSize;
          pos.mae = Math.max(pos.mae, adverse);
          pos.mfe = Math.max(pos.mfe, favorable);
        }
      } else {
        const slHit = pos.sl !== null && candle.high >= pos.sl;
        const tpHit = pos.tp !== null && candle.low <= pos.tp;

        if (slHit && tpHit && this.intrabarMode === 'worst_case') {
          triggered.push({
            positionId: id,
            type: 'sl',
            triggerPrice: pos.sl!,
            candleTime: candle.time,
          });
          const pnl = this.calculatePnL(pos, pos.sl!);
          this.balance += pnl;
          this.openPositions.delete(id);
          continue;
        }

        if (slHit) {
          triggered.push({
            positionId: id,
            type: 'sl',
            triggerPrice: pos.sl!,
            candleTime: candle.time,
          });
          const pnl = this.calculatePnL(pos, pos.sl!);
          this.balance += pnl;
          this.openPositions.delete(id);
          continue;
        }
        if (tpHit) {
          triggered.push({
            positionId: id,
            type: 'tp',
            triggerPrice: pos.tp!,
            candleTime: candle.time,
          });
          const pnl = this.calculatePnL(pos, pos.tp!);
          this.balance += pnl;
          this.openPositions.delete(id);
          continue;
        }
        if (updateMAEMFE) {
          const adverse = (candle.high - pos.entryPrice) / this.pipSize;
          const favorable = (pos.entryPrice - candle.low) / this.pipSize;
          pos.mae = Math.max(pos.mae, adverse);
          pos.mfe = Math.max(pos.mfe, favorable);
        }
      }

      // Update unrealized PnL
      pos.unrealizedPnL = this.calculatePnL(pos, candle.close);
    }

    return triggered;
  }

  private calculatePnL(pos: OpenPosition, closePrice: number): number {
    const priceDiff =
      pos.side === 'buy'
        ? closePrice - pos.entryPrice
        : pos.entryPrice - closePrice;
    return priceDiff * this.contractSize * pos.volume;
  }

  private calculateTotalUnrealizedPnL(currentPrice: number): number {
    let total = 0;
    for (const pos of this.openPositions.values()) {
      total += this.calculatePnL(pos, currentPrice);
    }
    return total;
  }

  private buildUpdate(
    candle: CandleFrame,
    triggeredSLTP: TriggeredSLTP[],
  ): ReplayUpdate {
    return {
      sessionId: this.sessionId,
      candle,
      state: this.getState(),
      openPositions: Array.from(this.openPositions.values()),
      triggeredSLTP,
    };
  }

  private complete(): void {
    this.status = 'completed';
    this.onCompleteCallback?.(this.getState());
  }

  private stopInterval(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.immediateHandle) {
      clearImmediate(this.immediateHandle);
      this.immediateHandle = null;
    }
  }

  private getIntervalMs(): number {
    const baseMs: Record<string, number> = {
      '1': 300,
      '5': 250,
      '15': 200,
      '30': 180,
      '60': 150,
      '240': 100,
      '1440': 80,
      '10080': 60,
    };
    const base = baseMs[this.resolution] ?? 200;
    if (this.speed === 'instant') return 0;
    return Math.max(10, Math.floor(base / (this.speed as number)));
  }

  destroy(): void {
    this.stopInterval();
    this.openPositions.clear();
    this.onUpdateCallback = null;
    this.onCompleteCallback = null;
    this.onErrorCallback = null;
  }
}
