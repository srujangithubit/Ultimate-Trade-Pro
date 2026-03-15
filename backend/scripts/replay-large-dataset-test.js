/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const { ReplayEngine } = require('../dist/src/backtesting/replay/replay-engine');

const prisma = new PrismaClient();

function nowMs() {
  const [sec, nanosec] = process.hrtime();
  return sec * 1000 + nanosec / 1e6;
}

function toCandleFrame(row, index) {
  return {
    time: Math.floor(new Date(row.time).getTime() / 1000),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume),
    index,
  };
}

async function loadCandles(symbol, resolution, count) {
  const start = nowMs();
  const rows = await prisma.marketDataCandle.findMany({
    where: { symbol, resolution },
    orderBy: [{ time: 'desc' }, { id: 'desc' }],
    take: count,
    select: {
      id: true,
      time: true,
      open: true,
      high: true,
      low: true,
      close: true,
      volume: true,
    },
  });
  const latencyMs = nowMs() - start;
  const asc = rows.reverse().map(toCandleFrame);
  return { candles: asc, latencyMs };
}

function replayOnce(candles) {
  return new Promise((resolve, reject) => {
    const entry = candles[0].close;
    const engine = new ReplayEngine(
      {
        sessionId: 'benchmark-session',
        symbol: 'EURUSD',
        resolution: '1',
        startingBalance: 10000,
      },
      candles,
    );

    const sl = entry - 0.0010;
    const tp = entry + 0.0015;

    engine.addPosition({
      id: 'bench-pos-1',
      side: 'buy',
      volume: 1,
      entryPrice: entry,
      entryTime: candles[0].time,
      sl,
      tp,
      mae: 0,
      mfe: 0,
      unrealizedPnL: 0,
    });

    let peakHeapUsed = process.memoryUsage().heapUsed;
    const memorySampleStep = 5000;
    const triggered = [];
    const replayStart = nowMs();

    engine.onUpdate((update) => {
      if (update.candle.index % memorySampleStep === 0) {
        const heapUsed = process.memoryUsage().heapUsed;
        if (heapUsed > peakHeapUsed) peakHeapUsed = heapUsed;
      }
      if (update.triggeredSLTP.length > 0) {
        for (const ev of update.triggeredSLTP) {
          triggered.push({
            type: ev.type,
            price: ev.triggerPrice,
            candleTime: ev.candleTime,
          });
        }
      }
    });

    engine.onError((error) => reject(error));

    engine.onComplete((finalState) => {
      const replayMs = nowMs() - replayStart;
      resolve({ finalState, replayMs, peakHeapUsed, triggered });
    });

    engine.setSpeed('instant');
    engine.play();
  });
}

async function main() {
  const symbol = 'EURUSD';
  const resolution = '1';
  const candleCount = 120000;

  const totalCount = await prisma.marketDataCandle.count({
    where: { symbol, resolution },
  });

  if (totalCount < candleCount) {
    throw new Error(
      `Not enough candles for ${symbol} ${resolution}. Found ${totalCount}, need ${candleCount}.`,
    );
  }

  const { candles, latencyMs } = await loadCandles(symbol, resolution, candleCount);

  if (candles.length !== candleCount) {
    throw new Error(
      `Unexpected truncation: loaded ${candles.length}, expected ${candleCount}.`,
    );
  }

  const run1 = await replayOnce(candles);
  const run2 = await replayOnce(candles);

  const pnlConsistent =
    Math.abs(run1.finalState.balance - run2.finalState.balance) < 1e-9;

  const summary = {
    dataset: {
      symbol,
      resolution,
      candlesRequested: candleCount,
      candlesLoaded: candles.length,
      availableCandles: totalCount,
      startTime: new Date(candles[0].time * 1000).toISOString(),
      endTime: new Date(candles[candles.length - 1].time * 1000).toISOString(),
    },
    performance: {
      queryLatencyMs: Number(latencyMs.toFixed(2)),
      replayMsRun1: Number(run1.replayMs.toFixed(2)),
      replayMsRun2: Number(run2.replayMs.toFixed(2)),
      replayCandlesPerSecRun1: Number(
        (candles.length / (run1.replayMs / 1000)).toFixed(2),
      ),
      replayCandlesPerSecRun2: Number(
        (candles.length / (run2.replayMs / 1000)).toFixed(2),
      ),
      peakHeapMBRun1: Number((run1.peakHeapUsed / (1024 * 1024)).toFixed(2)),
      peakHeapMBRun2: Number((run2.peakHeapUsed / (1024 * 1024)).toFixed(2)),
    },
    correctness: {
      truncationDetected: candles.length !== candleCount,
      slTpTriggeredRun1: run1.triggered.length,
      slTpTriggeredRun2: run2.triggered.length,
      finalBalanceRun1: run1.finalState.balance,
      finalBalanceRun2: run2.finalState.balance,
      pnlConsistent,
    },
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error('Replay benchmark failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
