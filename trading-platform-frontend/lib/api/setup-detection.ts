import { api } from './client';

export interface OhlcCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface SetupStrategy {
  name: string;
  rules: string[];
  conditions?: string[];
  tags?: string[];
}

export interface ImpulseSwing {
  origin: number;
  termination: number;
  direction: 'bullish' | 'bearish';
}

export interface FibonacciLevels {
  '0.236': number | null;
  '0.382': number | null;
  '0.500': number | null;
  '0.618': number | null;
  '0.705': number | null;
  '0.786': number | null;
}

export interface DetectedConditions {
  trend_direction: 'bullish' | 'bearish' | 'ranging';
  market_structure: string;
  structure_events: string[];
  impulse_move_detected: boolean;
  impulse_swing: ImpulseSwing;
  fibonacci_levels: FibonacciLevels;
  price_at_fibonacci_level: string;
  key_level_confluence: boolean;
  confluence_zone: number;
  confirmation_candle: string;
  confirmation_candle_detected: boolean;
}

export interface ConfidenceBreakdown {
  structure_valid: boolean;
  impulse_detected: boolean;
  key_level_reached: boolean;
  confluence_present: boolean;
  confirmation_candle: boolean;
}

export interface SwingPoints {
  last_swing_high: number;
  last_swing_low: number;
  prior_swing_high: number;
  prior_swing_low: number;
}

export interface RiskReference {
  suggested_stop_zone: number;
  invalidation_level: number;
}

export type SetupStage =
  | 'Early Formation'
  | 'Setup Forming'
  | 'Entry Zone'
  | 'Confirmation'
  | 'Insufficient Data'
  | 'Error';

export type AlertPriority = 'none' | 'watch' | 'high';

export interface SetupDetectionResult {
  symbol: string;
  timeframe: string;
  strategy_name: string;
  scan_time: string;
  setup_stage: SetupStage;
  confidence_score: number;
  alert_triggered: boolean;
  alert_priority: AlertPriority;
  detected_conditions: DetectedConditions;
  confidence_breakdown: ConfidenceBreakdown;
  swing_points: SwingPoints;
  risk_reference: RiskReference;
  alert_message: string;
  notes: string;
}

export interface DetectSetupPayload {
  symbol: string;
  timeframe: string;
  current_price: number;
  ohlc_data: OhlcCandle[];
  strategy: SetupStrategy;
}

export const setupDetectionApi = {
  scan: async (payload: DetectSetupPayload): Promise<SetupDetectionResult> => {
    const { data } = await api.post<SetupDetectionResult>(
      '/setup-detection/scan',
      payload,
    );
    return data;
  },
};
