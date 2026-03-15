'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useTradingStore } from '@/lib/stores/tradingStore';
import { useReplay } from '@/lib/hooks/useReplay';
import type { ReplaySpeed } from '@/lib/types/trading';

const SPEEDS: ReplaySpeed[] = [1, 5, 'instant'];

export default function ReplayControls() {
    const replayActive = useTradingStore((s) => s.replayActive);
    const setReplayRange = useTradingStore((s) => s.setReplayRange);

    const {
        play,
        pause,
        seek,
        setSpeed,
        isPlaying,
        progress,
        currentTimestamp,
        isLoading,
    } = useReplay();

    return (
        <AnimatePresence>
            {replayActive && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                >
                    <div className="flex items-center gap-3 px-3 py-2 bg-card border-b border-border">
                        {/* Play/Pause */}
                        <button
                            onClick={isPlaying ? pause : play}
                            disabled={isLoading}
                            className="w-7 h-7 flex items-center justify-center rounded bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors disabled:opacity-30"
                        >
                            {isPlaying ? (
                                <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
                                    <rect x="0" y="0" width="3" height="12" />
                                    <rect x="7" y="0" width="3" height="12" />
                                </svg>
                            ) : (
                                <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
                                    <polygon points="0,0 10,6 0,12" />
                                </svg>
                            )}
                        </button>

                        {/* Progress slider */}
                        <div className="flex-1 relative">
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={progress * 100}
                                onChange={(e) => {
                                    // Approximate seek based on slider position
                                    const pct = parseFloat(e.target.value) / 100;
                                    if (currentTimestamp) {
                                        seek(currentTimestamp);
                                    }
                                }}
                                className="w-full h-1 appearance-none bg-muted rounded-full cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-400 [&::-webkit-slider-thumb]:cursor-pointer"
                            />
                        </div>

                        {/* Speed buttons */}
                        <div className="flex gap-0.5">
                            {SPEEDS.map((s) => (
                                <button
                                    key={String(s)}
                                    onClick={() => setSpeed(s)}
                                    className={`px-2 py-1 text-[9px] font-mono rounded transition-colors ${useTradingStore.getState().replaySpeed === s
                                            ? 'bg-amber-500/20 text-amber-400'
                                            : 'text-muted-foreground hover:text-foreground/50'
                                        }`}
                                >
                                    {s === 'instant' ? '⚡' : `${s}×`}
                                </button>
                            ))}
                        </div>

                        {/* Date picker placeholder */}
                        <button
                            onClick={() => {
                                const now = Date.now();
                                setReplayRange({ from: now - 24 * 60 * 60 * 1000, to: now });
                            }}
                            className="px-2 py-1 text-[9px] font-mono text-muted-foreground border border-border rounded hover:text-foreground/50 transition-colors"
                        >
                            📅 Last 24h
                        </button>

                        {/* Timestamp display */}
                        <span className="text-[9px] font-mono text-muted-foreground min-w-[120px] text-right">
                            {currentTimestamp
                                ? new Date(currentTimestamp).toLocaleString('en-US', {
                                    month: 'short', day: '2-digit',
                                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                                })
                                : '—'}
                        </span>

                        {/* Loading indicator */}
                        {isLoading && (
                            <div className="h-3 w-3 animate-spin rounded-full border border-indigo-500/30 border-t-indigo-500" />
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
