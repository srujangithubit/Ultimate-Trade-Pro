const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check BEFORE
  const before = await prisma.marketDataCandle.findFirst({
    where: { symbol: 'XAUUSD', resolution: '60' },
    orderBy: { time: 'asc' },
    select: { time: true },
  });
  console.log('BEFORE - First XAUUSD H1:', before?.time?.toISOString());

  // Run the update using $executeRawUnsafe (no template literals / $ issues)
  console.log('Running UPDATE...');
  const count = await prisma.$executeRawUnsafe(
    "UPDATE \"MarketDataCandle\" SET time = time - INTERVAL '2 hours'"
  );
  console.log('Rows updated:', count);

  // Check AFTER
  const after = await prisma.marketDataCandle.findFirst({
    where: { symbol: 'XAUUSD', resolution: '60' },
    orderBy: { time: 'asc' },
    select: { time: true },
  });
  console.log('AFTER - First XAUUSD H1:', after?.time?.toISOString());

  // Check Monday open
  const mon = await prisma.marketDataCandle.findMany({
    where: {
      symbol: 'XAUUSD', resolution: '60',
      time: { gte: new Date('2025-01-05T20:00:00Z'), lte: new Date('2025-01-06T04:00:00Z') },
    },
    orderBy: { time: 'asc' },
    select: { time: true },
  });
  console.log('Mon Jan 6 candles (should start ~23:00Z Sun):');
  mon.forEach(c => console.log(' ', c.time.toISOString()));

  await prisma['$disconnect']();
}

main().catch(e => { console.error(e); process.exit(1); });
