import { ReplayEngine } from './replay-engine';
import { CandleFrame } from '../types/replay.types';

describe('ReplayEngine intrabar policy', () => {
  const candle: CandleFrame = {
    time: 1710000000,
    open: 100,
    high: 110,
    low: 90,
    close: 100,
    volume: 1000,
    index: 0,
  };

  async function runEngine(engine: ReplayEngine): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      engine.onComplete(() => resolve());
      engine.onError((error) => reject(error));
      engine.setSpeed('instant');
      engine.play();
    });
  }

  it('should execute SL first for BUY when both SL and TP are touched in one candle', async () => {
    const engine = new ReplayEngine(
      {
        sessionId: 's1',
        symbol: 'EURUSD',
        resolution: '1',
        startingBalance: 10000,
      },
      [candle],
    );

    engine.addPosition({
      id: 'buy-1',
      side: 'buy',
      volume: 1,
      entryPrice: 100,
      entryTime: candle.time,
      sl: 95,
      tp: 105,
      mae: 0,
      mfe: 0,
      unrealizedPnL: 0,
    });

    const updates: Array<{ type: string; triggerPrice: number }> = [];
    engine.onUpdate((update) => {
      if (update.triggeredSLTP.length > 0) {
        updates.push({
          type: update.triggeredSLTP[0].type,
          triggerPrice: update.triggeredSLTP[0].triggerPrice,
        });
      }
    });

    await runEngine(engine);

    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ type: 'sl', triggerPrice: 95 });
  });

  it('should execute SL first for SELL when both SL and TP are touched in one candle', async () => {
    const engine = new ReplayEngine(
      {
        sessionId: 's2',
        symbol: 'EURUSD',
        resolution: '1',
        startingBalance: 10000,
      },
      [candle],
    );

    engine.addPosition({
      id: 'sell-1',
      side: 'sell',
      volume: 1,
      entryPrice: 100,
      entryTime: candle.time,
      sl: 105,
      tp: 95,
      mae: 0,
      mfe: 0,
      unrealizedPnL: 0,
    });

    const updates: Array<{ type: string; triggerPrice: number }> = [];
    engine.onUpdate((update) => {
      if (update.triggeredSLTP.length > 0) {
        updates.push({
          type: update.triggeredSLTP[0].type,
          triggerPrice: update.triggeredSLTP[0].triggerPrice,
        });
      }
    });

    await runEngine(engine);

    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ type: 'sl', triggerPrice: 105 });
  });
});
