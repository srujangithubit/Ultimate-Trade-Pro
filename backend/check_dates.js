const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const r = await p.$queryRawUnsafe(
    'SELECT MIN(time) as earliest, MAX(time) as latest FROM "MarketDataCandle" WHERE symbol=$1 AND resolution=$2',
    'XAUUSD', '5'
  );
  console.log('XAUUSD M5 date range:', JSON.stringify(r, null, 2));
  await p.$disconnect();
})();
