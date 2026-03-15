'use client';

import { TradeAnalysisView } from '../backtesting/trade-analysis/page';

export default function TradeAnalysisPage() {
  return <TradeAnalysisView scope="account" backHref="/overview" />;
}
