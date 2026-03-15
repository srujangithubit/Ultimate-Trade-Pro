'use client';

import { useRef, useEffect } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';
import { ReplaySpeed } from '@/lib/types/backtesting';
import { motion, AnimatePresence } from 'framer-motion';

interface PlaybackControlsProps {
    onPlayPause: () => void;
    onSeek: (index: number) => void;
    onSpeedChange: (speed: ReplaySpeed) => void;
    totalCandles: number;
    replaySpeed: ReplaySpeed;
    isPlaying: boolean;
    progressRef: React.MutableRefObject<number>;
    indexRef: React.MutableRefObject<number>;
    timeRef: React.MutableRefObject<number>;
}

export function PlaybackControls({
    onPlayPause,
    onSeek,
    onSpeedChange,
    totalCandles,
    replaySpeed,
    isPlaying,
    progressRef,
    indexRef,
    timeRef,
}: PlaybackControlsProps) {
    const sliderRef = useRef<HTMLInputElement>(null);
    const indexLabelRef = useRef<HTMLSpanElement>(null);
    const timeLabelRef = useRef<HTMLSpanElement>(null);

    // Local state to track isPlaying for icon render — updated from ref via rAF

    useEffect(() => {
        let animationFrameId: number;

        const renderLoop = () => {
            // Sync slider
            if (sliderRef.current && sliderRef.current.value !== String(indexRef.current)) {
                sliderRef.current.value = String(indexRef.current);
            }
            // Sync candle index label
            if (indexLabelRef.current) {
                indexLabelRef.current.innerText = String(indexRef.current);
            }
            // Sync time label
            if (timeLabelRef.current && timeRef.current > 0) {
                const d = new Date(timeRef.current * 1000);
                const pad = (n: number) => n.toString().padStart(2, '0');
                timeLabelRef.current.innerText = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
            }
            animationFrameId = requestAnimationFrame(renderLoop);
        };

        renderLoop();

        return () => cancelAnimationFrame(animationFrameId);
    }, [indexRef, timeRef]);

    const speeds: ReplaySpeed[] = [1, 2, 5, 10, 'instant'];

    return (
        <div className="relative z-40 h-20 min-h-20 bg-card/95 border border-border rounded-xl shadow-lg backdrop-blur-sm flex flex-col px-4 py-2 gap-2 shrink-0">

            {/* Top row: progress timeline */}
            <div className="flex items-center gap-3 w-full">
                <span ref={indexLabelRef} className="text-xs text-muted-foreground font-mono w-12 text-right">0</span>
                <input
                    ref={sliderRef}
                    type="range"
                    min="0"
                    max={totalCandles}
                    step="1"
                    defaultValue={0}
                    className="flex-1 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-[#00d4aa]"
                    onChange={(e) => onSeek(parseInt(e.target.value))}
                />
                <span className="text-xs text-muted-foreground font-mono w-12">{totalCandles}</span>
            </div>

            {/* Bottom row: controls */}
            <div className="flex items-center gap-4 w-full">
                <span ref={timeLabelRef} className="text-xs text-muted-foreground font-mono w-32">
                    --
                </span>

                <div className="flex items-center gap-1 mx-auto bg-muted/50 p-1 rounded-lg border border-border/50">
                    <button
                        onClick={() => onSeek(Math.max(0, indexRef.current - 1))}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                        title="Previous candle"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <button
                        onClick={onPlayPause}
                        className="p-2 text-[#06110e] bg-[#00d4aa] hover:bg-[#00e6b8] rounded-md transition-colors w-10 h-10 flex items-center justify-center shadow-[0_0_0_1px_rgba(0,212,170,0.5)]"
                        title={isPlaying ? 'Pause' : 'Play'}
                    >
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={isPlaying ? 'pause' : 'play'}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.15 }}
                            >
                                {isPlaying ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5 ml-0.5" fill="currentColor" />}
                            </motion.div>
                        </AnimatePresence>
                    </button>

                    <button
                        onClick={() => onSeek(Math.min(totalCandles, indexRef.current + 1))}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                        title="Next candle"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex items-center gap-1">
                    {speeds.map((s) => (
                        <button
                            key={s}
                            onClick={() => onSpeedChange(s)}
                            className={`px-2 py-1 text-xs font-bold rounded transition-colors ${replaySpeed === s
                                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent'
                                }`}
                        >
                            {s === 'instant' ? 'MAX' : `${s}x`}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
