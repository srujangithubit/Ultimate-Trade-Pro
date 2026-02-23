import { Injectable } from '@nestjs/common';

@Injectable()
export class DrawdownCalculator {
  calculate(equityCurve: Array<{ date: Date; equity: number }>): {
    maxDrawdown: number;
    maxDrawdownPercent: number;
    currentDrawdown: number;
  } {
    let peak = 0;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;

    for (const point of equityCurve) {
      if (point.equity > peak) {
        peak = point.equity;
      }

      const drawdown = peak - point.equity;
      const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;

      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      if (drawdownPercent > maxDrawdownPercent)
        maxDrawdownPercent = drawdownPercent;
    }

    return {
      maxDrawdown,
      maxDrawdownPercent,
      currentDrawdown:
        peak > 0 && equityCurve.length > 0
          ? ((peak - equityCurve[equityCurve.length - 1].equity) / peak) * 100
          : 0,
    };
  }
}
