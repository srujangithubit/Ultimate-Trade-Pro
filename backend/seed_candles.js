const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
    console.log('Seeding fake XAUUSD 1h candles...');

    const symbol = 'XAUUSD';
    const resolution = '1h';

    // Clean up existing if any
    await prisma.marketDataCandle.deleteMany({
        where: { symbol, resolution }
    });

    const now = new Date();
    now.setMinutes(0, 0, 0); // Start at top of the current hour

    const totalCandles = 5000;
    let currentPrice = 2000.50; // Real-ish gold price

    const candles = [];

    for (let i = totalCandles; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60 * 60 * 1000);

        // Simulate random walk
        const volatility = 2.0;
        const change = (Math.random() - 0.5) * volatility;

        const open = currentPrice;
        const close = +(currentPrice + change).toFixed(2);

        // Wicks
        const high = +(Math.max(open, close) + Math.random() * volatility).toFixed(2);
        const low = +(Math.min(open, close) - Math.random() * volatility).toFixed(2);

        const volume = Math.floor(Math.random() * 5000) + 500;

        candles.push({
            symbol,
            resolution,
            time,
            open,
            high,
            low,
            close,
            volume
        });

        currentPrice = close;
    }

    // Insert in batches
    const batchSize = 1000;
    for (let i = 0; i < candles.length; i += batchSize) {
        const batch = candles.slice(i, i + batchSize);
        await prisma.marketDataCandle.createMany({
            data: batch,
            skipDuplicates: true,
        });
        console.log(`Inserted batch ${i / batchSize + 1} / ${Math.ceil(candles.length / batchSize)}`);
    }

    console.log('Seeding complete!');

    const res = await prisma.marketDataCandle.count({ where: { symbol } });
    console.log('Total XAUUSD candles:', res);
}

seed().catch(console.error).finally(() => prisma.$disconnect());
