const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const count = await p.marketDataCandle.count();
  console.log('Total candles:', count);

  const combos = await p.$queryRawUnsafe(
    'SELECT symbol, resolution, COUNT(*) as cnt FROM "MarketDataCandle" GROUP BY symbol, resolution ORDER BY cnt DESC LIMIT 20'
  );
  console.log('Combinations:', JSON.stringify(combos, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));

  if (count > 0) {
    const sample = await p.marketDataCandle.findMany({
      take: 3,
      orderBy: { time: 'desc' },
      select: { symbol: true, resolution: true, time: true, open: true, close: true },
    });
    console.log('Sample:', JSON.stringify(sample, (k, v) => typeof v === 'object' && v !== null && typeof v.toString === 'function' && !(v instanceof Date) ? v.toString() : v, 2));
  }

  // Check what sessions expect
  const sessions = await p.backtestingSession.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, status: true, configuration: true },
  });
  console.log('\nRecent sessions:');
  for (const s of sessions) {
    const cfg = typeof s.configuration === 'string' ? JSON.parse(s.configuration) : s.configuration;
    console.log(`  ${s.id} | ${s.name} | ${s.status} | instrument=${cfg?.instrument || cfg?.symbol} timeframe=${cfg?.timeframe || cfg?.resolution}`);
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
