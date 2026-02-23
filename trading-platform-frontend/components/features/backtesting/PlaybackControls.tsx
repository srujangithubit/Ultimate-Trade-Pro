'use client';

import { Play, Pause, FastForward, SkipForward, SkipBack } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';

interface PlaybackControlsProps {
    sessionId: string;
    isPlaying: boolean;
    onPlayPause: () => void;
    speed: number;
    onSpeedChange: (speed: number) => void;
}

export default function PlaybackControls({
    isPlaying,
    onPlayPause,
    speed,
    onSpeedChange,
}: PlaybackControlsProps) {
    const speedPresets = [1, 5, 10, 25, 50, 100];

    return (
        <div className="flex items-center gap-3 p-3 border rounded-xl bg-card shadow-sm">
            {/* Playback buttons */}
            <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8">
                    <SkipBack className="h-4 w-4" />
                </Button>

                <Button
                    size="icon"
                    onClick={onPlayPause}
                    className={`h-10 w-10 rounded-full ${isPlaying ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'}`}
                >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                </Button>

                <Button size="icon" variant="ghost" className="h-8 w-8">
                    <FastForward className="h-4 w-4" />
                </Button>

                <Button size="icon" variant="ghost" className="h-8 w-8">
                    <SkipForward className="h-4 w-4" />
                </Button>
            </div>

            {/* Divider */}
            <div className="h-8 w-px bg-border" />

            {/* Speed control */}
            <div className="flex items-center gap-3 flex-1">
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Speed</span>
                <Slider
                    value={[speed]}
                    onValueChange={(v) => onSpeedChange(v[0])}
                    min={1}
                    max={100}
                    step={1}
                    className="flex-1 max-w-48"
                />
                <Badge variant="secondary" className="font-mono text-xs min-w-[45px] justify-center">
                    {speed}x
                </Badge>
            </div>

            {/* Speed presets */}
            <div className="hidden lg:flex items-center gap-1">
                {speedPresets.map((preset) => (
                    <button
                        key={preset}
                        onClick={() => onSpeedChange(preset)}
                        className={`px-2 py-1 text-xs rounded-md transition-smooth ${speed === preset
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent'
                            }`}
                    >
                        {preset}x
                    </button>
                ))}
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
                <span className="text-xs text-muted-foreground">{isPlaying ? 'Running' : 'Paused'}</span>
            </div>
        </div>
    );
}
