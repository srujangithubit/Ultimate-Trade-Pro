export interface DrawingPoint {
  time: number;   // UTCTimestamp (seconds)
  price: number;
}

export interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  fillColor?: string;
  fillOpacity?: number;
  fontSize?: number;
}

/** Per-level configuration for Fibonacci tools */
export interface FibLevelConfig {
  r: number;        // ratio (0, 0.236, 0.382, …)
  enabled: boolean;
  color: string;
}

/** Drawing-specific configuration (serialised into `config`) */
export interface DrawingConfig {
  /** Fibonacci: custom levels */
  fibLevels?: FibLevelConfig[];
  /** Fibonacci: show the diagonal trend line */
  showTrendLine?: boolean;
  /** Fibonacci: trend line color */
  trendLineColor?: string;
  /** Fibonacci: trend line style */
  trendLineStyle?: 'solid' | 'dashed' | 'dotted';
  /** Fibonacci: levels line style */
  levelsLineStyle?: 'solid' | 'dashed' | 'dotted';
  /** Fibonacci: levels line width */
  levelsLineWidth?: number;
  /** Fibonacci: extend direction */
  extend?: 'none' | 'left' | 'right' | 'both';
}

export interface DrawingObject {
  id: string;
  type: string;
  points: DrawingPoint[];
  style: DrawingStyle;
  text?: string;
  visible: boolean;
  locked: boolean;
  /** Selected for editing */
  selected?: boolean;
  /** Brush / freehand strokes: array of {time,price} polyline points */
  freehandPoints?: DrawingPoint[];
  /** Pattern labels (e.g. X,A,B,C,D or 1,2,3,4,5) */
  labels?: string[];
  /** Per-drawing configuration (fib levels, extend, etc.) */
  config?: DrawingConfig;
}
