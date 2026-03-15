'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Maximize2 } from 'lucide-react';
import type { ChartSnapshot } from '@/lib/types/community';

interface ChartMiniPreviewProps {
  snapshot: ChartSnapshot;
  className?: string;
}

/**
 * A mini chart preview thumbnail for community posts.
 * If lightweight-charts is available, it renders a mini chart.
 * Otherwise shows a placeholder.
 */
export default function ChartMiniPreview({
  snapshot,
  className = '',
}: ChartMiniPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`relative rounded-lg border border-border bg-card overflow-hidden group ${className}`}
    >
      <div
        ref={containerRef}
        className="w-full h-32 bg-muted/30 flex items-center justify-center"
      >
        <div className="text-center">
          <p className="text-xs font-mono text-muted-foreground">
            {snapshot.symbol} · {snapshot.timeframe}
          </p>
          {snapshot.visibleRangeFrom && snapshot.visibleRangeTo && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {new Date(snapshot.visibleRangeFrom * 1000).toLocaleDateString()}{' '}
              → {new Date(snapshot.visibleRangeTo * 1000).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* Expand icon */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="h-6 w-6 rounded bg-background/80 backdrop-blur flex items-center justify-center">
          <Maximize2 className="h-3.5 w-3.5" />
        </div>
      </div>
    </motion.div>
  );
}
