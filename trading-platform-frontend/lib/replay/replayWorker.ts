/**
 * Web Worker for instant-speed replay tick processing.
 * Receives all ticks and posts them back one at a time.
 */

interface Tick {
    symbol: string;
    bid: string;
    ask: string;
    last: string;
    volume: string;
    timestamp: number;
}

self.onmessage = (e: MessageEvent<{ ticks: Tick[] }>) => {
    const { ticks } = e.data;

    for (let i = 0; i < ticks.length; i++) {
        self.postMessage({ type: 'tick', tick: ticks[i] });
    }

    self.postMessage({ type: 'complete' });
};
