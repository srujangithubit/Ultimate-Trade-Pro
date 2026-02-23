import { Injectable } from '@nestjs/common';
import { TradeData } from '../interfaces/trade-data.interface';

@Injectable()
export class EquityCurveCalculator {
  calculate(
    trades: TradeData[],
    startingBalance: number,
  ): Array<{ date: Date; equity: number }> {
    let currentBalance = startingBalance;
    const curve = [{ date: new Date(0), equity: startingBalance }]; // Should start before first trade ideally

    // Sort trades by exit time
    const sortedTrades = [...trades].sort(
      (a, b) =>
        (a.exitDatetime?.getTime() || 0) - (b.exitDatetime?.getTime() || 0),
    );

    for (const trade of sortedTrades) {
      if (trade.exitDatetime) {
        currentBalance += trade.pnlNet;
        curve.push({
          date: trade.exitDatetime,
          equity: currentBalance,
        });
      }
    }

    return curve;
  }
}
