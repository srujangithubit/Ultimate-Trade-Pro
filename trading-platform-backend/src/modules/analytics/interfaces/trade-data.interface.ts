export interface TradeData {
  pnlNet: number;
  pnlGross: number;
  fees?: number;
  commission?: number;
  riskRewardRatio?: number;
  tradeDurationMinutes?: number;
  entryDatetime: Date;
  exitDatetime: Date;
  setup?: string;
  direction?: 'LONG' | 'SHORT' | 'long' | 'short';
  instrument?: string;
  entryPrice?: number;
  quantity?: number;
  // Add other fields used by calculators if needed
}
