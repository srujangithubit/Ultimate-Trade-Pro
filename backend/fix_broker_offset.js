/**
 * One-time fix: Shift all candle timestamps by -2 hours to convert
 * from MT5 broker server time (UTC+2) to actual UTC.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Correcting all candle timestamps by -2 hours (MT5 broker UTC+2 → UTC)...');
  console.time('update');

  const result = await prisma.$executeRawUnsafe(
    `UPDATE "MarketDataCandle" SET time = time - INTERVAL '2 hours'`
  );

  console.timeEnd('update');
  console.log(`Updated ${result} rows`);

  // Verify
  const first = await prisma.marketDataCandle.findFirst({
    where: { symbol: 'XAUUSD', resolution: '60' },
    orderBy: { time: 'asc' },
    select: { time: true },
  });
  console.log('First XAUUSD H1 after fix:', first?.time.toISOString());

  const monCandles = await prisma.marketDataCandle.findMany({
    where: {
      symbol: 'XAUUSD',
      resolution: '60',
      time: { gte: new Date('2025-01-05T22:00:00Z'), lte: new Date('2025-01-06T04:00:00Z') },
    },
    orderBy: { time: 'asc' },
    select: { time: true },
  });
  console.log('XAUUSD H1 around Mon Jan 6 open (should start ~23:00Z Sun):');
  monCandles.forEach(c => console.log(' ', c.time.toISOString()));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
