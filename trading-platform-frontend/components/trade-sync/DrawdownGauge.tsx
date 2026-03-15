'use client';

import { motion } from 'framer-motion';

interface DrawdownGaugeProps {
  current: number;
  max: number;
  size?: number;
}

export default function DrawdownGauge({
  current: rawCurrent,
  max: rawMax,
  size = 80,
}: DrawdownGaugeProps) {
  const current = Number(rawCurrent) || 0;
  const max = Number(rawMax) || 0;
  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (percentage >= 80) return 'text-red-500';
    if (percentage >= 50) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="5"
          fill="none"
          className="text-muted/30"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          className={getColor()}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xs font-bold ${getColor()}`}>
          {current.toFixed(1)}%
        </span>
        <span className="text-[10px] text-muted-foreground">/ {max}%</span>
      </div>
    </div>
  );
}
