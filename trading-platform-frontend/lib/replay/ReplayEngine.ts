import type { Tick } from '@/lib/types/trading';
import type { ReplaySpeed } from '@/lib/types/trading';

/**
 * ReplayEngine — class-based tick replay engine.
 * Emits ticks at their relative timestamps scaled by speed factor.
 * Data flows through the same CandleChart path as live data.
 */
export class ReplayEngine {
    private ticks: Tick[] = [];
    private cursor = 0;
    private speed: ReplaySpeed = 1;
    private playing = false;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private tickCallback: ((tick: Tick) => void) | null = null;
    private completeCallback: (() => void) | null = null;
    private worker: Worker | null = null;

    /**
     * Load ticks into the engine and reset cursor.
     */
    load(ticks: Tick[]): void {
        this.ticks = ticks;
        this.cursor = 0;
        this.playing = false;
        this.clearInterval();
    }

    /**
     * Start playing ticks.
     * - 1x: real-time relative timestamps
     * - 5x: 5x faster
     * - 'instant': process all via Web Worker
     */
    play(): void {
        if (this.ticks.length === 0 || this.cursor >= this.ticks.length) return;

        this.playing = true;

        if (this.speed === 'instant') {
            this.playInstant();
            return;
        }

        this.startInterval();
    }

    /**
     * Pause playback.
     */
    pause(): void {
        this.playing = false;
        this.clearInterval();
    }

    /**
     * Seek to a specific timestamp using binary search.
     */
    seek(timestamp: number): void {
        const wasPaused = !this.playing;
        this.pause();

        let lo = 0;
        let hi = this.ticks.length - 1;

        while (lo <= hi) {
            const mid = Math.floor((lo + hi) / 2);
            if (this.ticks[mid].timestamp < timestamp) {
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }

        this.cursor = Math.min(lo, this.ticks.length - 1);

        if (!wasPaused) {
            this.play();
        }
    }

    /**
     * Change speed. If playing, restarts with new speed.
     */
    setSpeed(speed: ReplaySpeed): void {
        this.speed = speed;
        if (this.playing) {
            this.clearInterval();
            this.play();
        }
    }

    /**
     * Register tick callback.
     */
    onTick(callback: (tick: Tick) => void): void {
        this.tickCallback = callback;
    }

    /**
     * Register completion callback.
     */
    onComplete(callback: () => void): void {
        this.completeCallback = callback;
    }

    /**
     * Clean up all resources.
     */
    destroy(): void {
        this.clearInterval();
        this.tickCallback = null;
        this.completeCallback = null;
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }

    get progress(): number {
        if (this.ticks.length === 0) return 0;
        return this.cursor / this.ticks.length;
    }

    get currentTimestamp(): number {
        return this.ticks[this.cursor]?.timestamp ?? 0;
    }

    get isPlaying(): boolean {
        return this.playing;
    }

    get totalTicks(): number {
        return this.ticks.length;
    }

    // ── Private Methods ──────────────────────────────────────────────

    private startInterval(): void {
        this.clearInterval();

        const speedFactor = typeof this.speed === 'number' ? this.speed : 1;

        const emitNext = (): void => {
            if (!this.playing || this.cursor >= this.ticks.length) {
                this.playing = false;
                this.clearInterval();
                this.completeCallback?.();
                return;
            }

            const currentTick = this.ticks[this.cursor];
            this.tickCallback?.(currentTick);
            this.cursor++;

            // Calculate delay to next tick
            if (this.cursor < this.ticks.length) {
                const nextTick = this.ticks[this.cursor];
                const realDelay = nextTick.timestamp - currentTick.timestamp;
                const scaledDelay = Math.max(1, realDelay / speedFactor);

                // Cap at 100ms to prevent very long waits
                const cappedDelay = Math.min(scaledDelay, 100);

                this.intervalId = setTimeout(emitNext, cappedDelay) as unknown as ReturnType<typeof setInterval>;
            } else {
                this.playing = false;
                this.completeCallback?.();
            }
        };

        emitNext();
    }

    private playInstant(): void {
        try {
            // Try to use Web Worker for instant processing
            const workerUrl = new URL('./replayWorker.ts', import.meta.url);
            this.worker = new Worker(workerUrl, { type: 'module' });

            this.worker.onmessage = (e: MessageEvent) => {
                const data = e.data;
                if (data.type === 'tick') {
                    this.tickCallback?.(data.tick);
                    this.cursor++;
                } else if (data.type === 'complete') {
                    this.playing = false;
                    this.completeCallback?.();
                }
            };

            const remainingTicks = this.ticks.slice(this.cursor);
            this.worker.postMessage({ ticks: remainingTicks });
        } catch {
            // Fallback: process synchronously in batches
            this.playInstantSync();
        }
    }

    private playInstantSync(): void {
        const BATCH_SIZE = 100;

        const processBatch = (): void => {
            const end = Math.min(this.cursor + BATCH_SIZE, this.ticks.length);

            for (let i = this.cursor; i < end; i++) {
                this.tickCallback?.(this.ticks[i]);
            }

            this.cursor = end;

            if (this.cursor < this.ticks.length) {
                // Use requestAnimationFrame to avoid blocking UI
                requestAnimationFrame(processBatch);
            } else {
                this.playing = false;
                this.completeCallback?.();
            }
        };

        processBatch();
    }

    private clearInterval(): void {
        if (this.intervalId !== null) {
            clearTimeout(this.intervalId as unknown as number);
            this.intervalId = null;
        }
    }
}
