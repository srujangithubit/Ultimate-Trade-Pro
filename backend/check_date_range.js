const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const first = await p.marketDataCandle.findFirst({
    where: { symbol: 'XAUUSD', resolution: '60' },
    orderBy: { time: 'asc' },
    select: { time: true },
  });
  console.log('First XAUUSD H1:', first?.time);

  const last = await p.marketDataCandle.findFirst({
    where: { symbol: 'XAUUSD', resolution: '60' },
    orderBy: { time: 'desc' },
    select: { time: true },
  });
  console.log('Last XAUUSD H1:', last?.time);

  // Also check a few resolutions
  const resolutions = ['1', '5', '15', '30', '60', '240', '1440'];
  for (const res of resolutions) {
    const count = await p.marketDataCandle.count({ where: { symbol: 'XAUUSD', resolution: res } });
    console.log(`XAUUSD resolution=${res}: ${count} candles`);
  }

  await p.$disconnect();
})();
