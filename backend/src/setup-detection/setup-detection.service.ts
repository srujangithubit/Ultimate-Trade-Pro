import { Injectable, Logger } from '@nestjs/common';
import { ModelInferenceService } from '../common/model-inference.service';
import { DetectSetupDto } from './dto/detect-setup.dto';

const SYSTEM_PROMPT = `You are a trading setup detector. You MUST analyze the provided OHLC candle data and fill every field with ACTUAL computed values from the data. Do NOT return placeholder zeros or empty strings.

ANALYSIS STEPS:
1. STRUCTURE: Identify swing highs (high > N surrounding candles, N=3) and swing lows. Classify trend as bullish (HH+HL sequence), bearish (LL+LH sequence), or ranging. Detect BOS/CHoCH events.
2. IMPULSE: Find strong directional candles (body >= 1.5x average body of last 10). Record the swing origin and termination price levels.
3. FIBONACCI: Calculate from impulse swing. Bullish: Level = B-(B-A)*ratio. Bearish: Level = B+(A-B)*ratio. Use ratios: 0.236, 0.382, 0.500, 0.618, 0.705, 0.786. Check if current price is near any level.
4. S/R: Identify support/resistance from repeated swing points. Check confluence with Fibonacci levels.
5. CONFIRMATION: Check last few candles for reversal patterns (engulfing, pin bar, hammer) at key levels.
6. STAGE: Classify as one of: "Early Formation", "Setup Forming", "Entry Zone", "Confirmation", "Insufficient Data"
7. SCORE: Sum applicable points (max 100): structure aligned=25, impulse found=20, at key level=25, confluence=15, confirmation candle=15
8. ALERT: If stage is "Entry Zone" or "Confirmation" AND score>=70, set alert_triggered=true. Score>=90="high", >=70="watch", else "none"

CRITICAL: You MUST compute real price values from the OHLC data. Every numeric field must contain an actual price or score, NOT zero. Analyze the candles carefully.

Respond with ONLY a JSON object (no markdown fences, no explanation). Fields:
- symbol, timeframe, strategy_name: from input
- scan_time: current ISO timestamp
- setup_stage: your classification
- confidence_score: calculated 0-100
- alert_triggered: boolean
- alert_priority: "none", "watch", or "high"
- detected_conditions.trend_direction: "bullish", "bearish", or "ranging"
- detected_conditions.market_structure: description like "Higher Highs and Higher Lows"
- detected_conditions.structure_events: array of strings like ["BOS to upside"]
- detected_conditions.impulse_move_detected: boolean
- detected_conditions.impulse_swing: {origin: price, termination: price, direction: "bullish"/"bearish"}
- detected_conditions.fibonacci_levels: {"0.236": price, "0.382": price, "0.500": price, "0.618": price, "0.705": price, "0.786": price}
- detected_conditions.price_at_fibonacci_level: which level price is near, or "none"
- detected_conditions.key_level_confluence: boolean
- detected_conditions.confluence_zone: price level or 0
- detected_conditions.confirmation_candle: pattern name or "none"
- detected_conditions.confirmation_candle_detected: boolean
- confidence_breakdown: {structure_valid: bool, impulse_detected: bool, key_level_reached: bool, confluence_present: bool, confirmation_candle: bool}
- swing_points: {last_swing_high: price, last_swing_low: price, prior_swing_high: price, prior_swing_low: price}
- risk_reference: {suggested_stop_zone: price, invalidation_level: price}
- alert_message: summary string
- notes: any observations`;

@Injectable()
export class SetupDetectionService {
  private readonly logger = new Logger(SetupDetectionService.name);

  constructor(private modelService: ModelInferenceService) {}

  async detectSetup(dto: DetectSetupDto): Promise<any> {
    // Limit candles to last 30, keep only essential fields for smaller payload
    const candles = dto.ohlc_data.slice(-30).map((c) => ({
      t: c.time,
      o: c.open,
      h: c.high,
      l: c.low,
      c: c.close,
      v: c.volume ?? 0,
    }));
    const userMessage = JSON.stringify({
      symbol: dto.symbol,
      timeframe: dto.timeframe,
      current_price: dto.current_price,
      ohlc_data: candles,
      strategy: { name: dto.strategy.name, rules: dto.strategy.rules },
    });

    this.logger.log(
      `Detecting setup for ${dto.symbol} ${dto.timeframe} — strategy: ${dto.strategy.name} (${candles.length}/${dto.ohlc_data.length} candles)`,
    );

    try {
      const content = await this.modelService.generateText(
        SYSTEM_PROMPT,
        userMessage,
      );

      this.logger.log(`Model response received (${content.length} chars)`);
      this.logger.debug(`Raw model response: ${content.slice(0, 500)}`);

      try {
        return this.modelService.parseJson(content);
      } catch {
        this.logger.error(
          `Failed to parse setup detection response: ${content.slice(0, 200)}`,
        );
        return {
          symbol: dto.symbol,
          timeframe: dto.timeframe,
          strategy_name: dto.strategy.name,
          scan_time: new Date().toISOString(),
          setup_stage: 'Error',
          confidence_score: 0,
          alert_triggered: false,
          alert_priority: 'none',
          detected_conditions: {},
          confidence_breakdown: {},
          swing_points: {},
          risk_reference: {},
          alert_message: '',
          notes: 'Failed to parse AI response. Please retry.',
        };
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Model inference failed: ${err.message}`, err.stack);
      throw new Error(`Setup detection failed: ${err.message}`);
    }
  }
}
