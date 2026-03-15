/* eslint-disable no-console */
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { ReplayEngine } = require('../dist/src/backtesting/replay/replay-engine');

const prisma = new PrismaClient();

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

function signatureOfEvents(events) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(events))
    .digest('hex');
}

async function runReplay(candles) {
  return new Promise((resolve, reject) => {
    const engine = new ReplayEngine(
      {
        sessionId: 'determinism-session',
        symbol: 'EURUSD',
        resolution: '1',
        startingBalance: 10000,
      },
      candles,
    );

    const entry = candles[0].close;
    engine.addPosition({
      id: 'det-pos',
      side: 'buy',
      volume: 1,
      entryPrice: entry,
      entryTime: candles[0].time,
      sl: entry - 0.0010,
      tp: entry + 0.0015,
      mae: 0,
      mfe: 0,
      unrealizedPnL: 0,
    });

    const events = [];

    engine.onUpdate((update) => {
      for (const ev of update.triggeredSLTP) {
        events.push({
          type: ev.type,
          price: ev.triggerPrice,
          candleTime: ev.candleTime,
        });
      }
    });

    engine.onError((err) => reject(err));

    engine.onComplete((state) => {
      resolve({
        finalBalance: state.balance,
        eventSignature: signatureOfEvents(events),
        eventCount: events.length,
      });
    });

    engine.setSpeed('instant');
    engine.play();
  });
}

async function main() {
  const symbol = 'EURUSD';
  const resolution = '1';
  const candleCount = 120000;

  const rows = await prisma.marketDataCandle.findMany({
    where: { symbol, resolution },
    orderBy: [{ time: 'desc' }, { id: 'desc' }],
    take: candleCount,
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

  const candles = rows.reverse().map(toCandleFrame);
  if (candles.length !== candleCount) {
    throw new Error(`Expected ${candleCount} candles, got ${candles.length}`);
  }

  const runs = [];
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const result = await runReplay(candles);
    runs.push(result);
  }

  const first = runs[0];
  const allSameBalance = runs.every(
    (r) => Math.abs(r.finalBalance - first.finalBalance) < 1e-9,
  );
  const allSameSequence = runs.every(
    (r) => r.eventSignature === first.eventSignature && r.eventCount === first.eventCount,
  );

  const summary = {
    dataset: { symbol, resolution, candles: candleCount },
    runs,
    deterministic: allSameBalance && allSameSequence,
    checks: {
      tradeSequenceIdentical: allSameSequence,
      pnlIdentical: allSameBalance,
      noFloatingPointDrift: allSameBalance,
    },
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error('Determinism test failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
