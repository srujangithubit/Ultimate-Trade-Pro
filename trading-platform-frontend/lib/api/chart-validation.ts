import { api } from './client';

export interface ChecklistValidationItem {
    id: string;
    rule: string;
    status: 'valid' | 'invalid' | 'undetected';
    explanation: string;
}

export interface DetectedMarketConditions {
    timeframe: string;
    session: string;
    trend_direction: 'bullish' | 'bearish' | 'ranging';
    market_structure: string;
    key_levels: string[];
    fibonacci_levels_detected: string[];
    candlestick_patterns: string[];
    indicators_visible: string[];
}

export interface RiskAnalysis {
    entry_visible: boolean;
    stop_loss_visible: boolean;
    take_profit_visible: boolean;
    risk_reward_estimate: string;
    risk_reward_valid: boolean;
}

export interface ValidationSummary {
    valid_count: number;
    invalid_count: number;
    undetected_count: number;
    total_scoreable: number;
}

export interface ChartValidationResult {
    strategy_name: string;
    trade_score: number;
    setup_quality: string;
    checklist_validation: ChecklistValidationItem[];
    detected_market_conditions: DetectedMarketConditions;
    risk_analysis: RiskAnalysis;
    summary: ValidationSummary;
    final_assessment: string;
}

export interface ValidateChartPayload {
    strategy_name: string;
    strategy_rules: string[];
    checklist: { id: string; rule: string; type: string }[];
    screenshot: string;
    timeframe?: string;
}

export const chartValidationApi = {
    validate: async (payload: ValidateChartPayload): Promise<ChartValidationResult> => {
        const { data } = await api.post<ChartValidationResult>('/chart-validation/validate', payload);
        return data;
    },
};
