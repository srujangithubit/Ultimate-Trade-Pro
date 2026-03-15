import { Injectable, Logger } from '@nestjs/common';
import { ModelInferenceService } from '../common/model-inference.service';
import { ValidateChartDto } from './dto/validate-chart.dto';

const SYSTEM_PROMPT = `You are a chart setup validator. Analyze the chart screenshot against the strategy checklist.

For each checklist rule, set status: "valid" (visible on chart), "invalid" (contradicted), or "undetected" (can't confirm).
Score = valid / (valid + invalid) * 100. Grades: >=90 A+, >=75 A, >=60 B, >=40 C, <40 Invalid.

Identify from the chart: trend direction, market structure, key levels, patterns, entry/SL/TP if visible.

CRITICAL: Fill ALL fields with real values from the chart. Do NOT return zeros or empty strings.

Return ONLY valid JSON (no markdown, no explanation):
{"strategy_name":"","trade_score":0,"setup_quality":"A+|A|B|C|Invalid","checklist_validation":[{"id":"","rule":"","status":"valid|invalid|undetected","explanation":""}],"detected_market_conditions":{"timeframe":"","session":"","trend_direction":"bullish|bearish|ranging","market_structure":"","key_levels":[],"fibonacci_levels_detected":[],"candlestick_patterns":[],"indicators_visible":[]},"risk_analysis":{"entry_visible":true,"stop_loss_visible":true,"take_profit_visible":true,"risk_reward_estimate":"","risk_reward_valid":true},"summary":{"valid_count":0,"invalid_count":0,"undetected_count":0,"total_scoreable":0},"final_assessment":""}`;

@Injectable()
export class ChartValidationService {
  private readonly logger = new Logger(ChartValidationService.name);

  constructor(private modelService: ModelInferenceService) {}

  async validateChart(dto: ValidateChartDto): Promise<any> {
    const userMessage = JSON.stringify({
      strategy_name: dto.strategy_name,
      strategy_rules: dto.strategy_rules,
      checklist: dto.checklist,
      chart_timeframe: dto.timeframe || 'unknown',
    });

    // Strip the data URI prefix to get raw base64
    let base64Image = dto.screenshot;
    if (base64Image.startsWith('data:')) {
      base64Image = base64Image.replace(/^data:image\/\w+;base64,/, '');
    }

    this.logger.log(
      `Validating chart for strategy: ${dto.strategy_name} (${dto.checklist.length} rules, image: ${(base64Image.length / 1024).toFixed(0)}KB base64)`,
    );

    try {
      const content = await this.modelService.generateWithImage(
        SYSTEM_PROMPT,
        userMessage,
        base64Image,
      );

      this.logger.log(`Model response received (${content.length} chars)`);

      try {
        return this.modelService.parseJson(content);
      } catch {
        this.logger.error('Failed to parse model response as JSON');
        return {
          strategy_name: dto.strategy_name,
          trade_score: 0,
          setup_quality: 'Invalid',
          checklist_validation: [],
          detected_market_conditions: {},
          risk_analysis: {},
          summary: {
            valid_count: 0,
            invalid_count: 0,
            undetected_count: 0,
            total_scoreable: 0,
          },
          final_assessment:
            'Failed to parse AI response. Raw output: ' + content.slice(0, 500),
        };
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      const cause = (error as { cause?: Error })?.cause;
      this.logger.error(
        `Model inference failed: ${err.message}${cause ? ` — cause: ${cause.message}` : ''}`,
        err.stack,
      );
      throw new Error(`Chart validation failed: ${err.message}`);
    }
  }
}
