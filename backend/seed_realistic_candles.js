/**
 * Seed realistic XAUUSD 1H candle data into market_data_candles.
 * 
 * Generates price-action-accurate synthetic data that mimics real gold behavior:
 *  - Correct price range for 2025-2026 (~$2,600 - $2,900)
 *  - Realistic hourly volatility ($3-15 per candle)
 *  - Session-based volume patterns (Asian/London/NY)
 *  - Trend + mean-reversion dynamics
 *  - Weekend gaps (no candles Sat-Sun)
 *  - Proper OHLC relationships
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function randomNormal(mean = 0, stdDev = 1) {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    return mean + stdDev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function getSessionVolatility(hour) {
    // UTC hours — mimics real forex session volatility
    // Asian session (0-7 UTC): low vol
    // London session (7-15 UTC): high vol
    // NY session (12-20 UTC): highest vol (overlaps London)
    // Late NY (20-24 UTC): declining vol
    if (hour >= 12 && hour < 16) return 1.8;  // London/NY overlap — peak
    if (hour >= 7 && hour < 12) return 1.4;   // London morning
    if (hour >= 16 && hour < 20) return 1.3;  // NY afternoon
    if (hour >= 0 && hour < 7) return 0.7;    // Asian session
    return 0.5;                                // late session
}

function getSessionVolume(hour) {
    // Volume multiplier by session
    if (hour >= 12 && hour < 16) return 2.5;
    if (hour >= 7 && hour < 12) return 2.0;
    if (hour >= 16 && hour < 20) return 1.5;
    if (hour >= 0 && hour < 7) return 0.6;
    return 0.4;
}

function isWeekend(date) {
    const day = date.getUTCDay();
    return day === 0 || day === 6; // Sunday or Saturday
}

async function seed() {
    console.log('Seeding realistic XAUUSD 1H candles...');

    const symbol = 'XAUUSD';
    const resolution = '60';

    // Clear existing
    const deleted = await prisma.marketDataCandle.deleteMany({
        where: { symbol, resolution }
    });
    console.log(`Deleted ${deleted.count} existing candles`);

    // Generate candles from Aug 1, 2025 to Feb 28, 2026 (7 months)
    const startDate = new Date('2025-08-01T00:00:00Z');
    const endDate = new Date('2026-02-28T23:00:00Z');

    // Real XAUUSD prices in 2025: started ~$2,650, peaked near $2,950
    let currentPrice = 2652.30;

    // Trend parameters  
    const trendBias = 0.012;         // Slight upward drift per candle (gold bull market)
    const meanReversionTarget = 2780; // Long-term mean
    const meanReversionStrength = 0.001;
    const baseVolatility = 5.5;       // Base $ move per hourly candle

    const candles = [];
    let time = new Date(startDate);

    // Track daily ranges for realism
    let dayHigh = currentPrice;
    let dayLow = currentPrice;
    let lastDay = -1;

    while (time <= endDate) {
        // Skip weekends
        if (isWeekend(time)) {
            time = new Date(time.getTime() + 60 * 60 * 1000);
            continue;
        }

        const hour = time.getUTCHours();

        // Reset daily tracking
        if (time.getUTCDate() !== lastDay) {
            lastDay = time.getUTCDate();
            dayHigh = currentPrice;
            dayLow = currentPrice;

            // Occasional gap open on Monday (carry over weekend news)
            if (time.getUTCDay() === 1 && Math.random() < 0.4) {
                const gapSize = randomNormal(0, 8);
                currentPrice += gapSize;
            }
        }

        // Calculate movement
        const sessionVol = getSessionVolatility(hour);
        const volMultiplier = sessionVol * baseVolatility;

        // Mean reversion component
        const reversion = (meanReversionTarget - currentPrice) * meanReversionStrength;

        // Trend + noise + reversion
        const change = trendBias + reversion + randomNormal(0, volMultiplier);

        // OHLC generation
        const open = +currentPrice.toFixed(2);
        const close = +(currentPrice + change).toFixed(2);

        // Realistic wicks — bigger during volatile sessions
        const wickUp = Math.abs(randomNormal(0, volMultiplier * 0.6));
        const wickDown = Math.abs(randomNormal(0, volMultiplier * 0.6));

        const high = +(Math.max(open, close) + wickUp).toFixed(2);
        const low = +(Math.min(open, close) - wickDown).toFixed(2);

        // Volume: realistic for gold futures (contracts)
        const baseVolume = 8000;
        const volMult = getSessionVolume(hour);
        const volume = Math.floor(baseVolume * volMult * (0.5 + Math.random()));

        // Occasional volume spikes (news events)
        const finalVolume = Math.random() < 0.03 ? volume * 3 : volume;

        candles.push({
            symbol,
            resolution,
            time: new Date(time),
            open,
            high,
            low,
            close,
            volume: finalVolume.toFixed(8),
        });

        currentPrice = close;
        dayHigh = Math.max(dayHigh, high);
        dayLow = Math.min(dayLow, low);

        time = new Date(time.getTime() + 60 * 60 * 1000);
    }

    console.log(`Generated ${candles.length} realistic candles`);
    console.log(`Price range: $${Math.min(...candles.map(c => c.low)).toFixed(2)} - $${Math.max(...candles.map(c => c.high)).toFixed(2)}`);
    console.log(`First: ${candles[0].time.toISOString()} open=$${candles[0].open}`);
    console.log(`Last: ${candles[candles.length - 1].time.toISOString()} close=$${candles[candles.length - 1].close}`);

    // Insert in batches
    const batchSize = 500;
    for (let i = 0; i < candles.length; i += batchSize) {
        const batch = candles.slice(i, i + batchSize);
        await prisma.marketDataCandle.createMany({
            data: batch,
            skipDuplicates: true,
        });
        process.stdout.write(`\rInserted ${Math.min(i + batchSize, candles.length)} / ${candles.length}`);
    }

    console.log('\n\nSeeding complete!');

    const total = await prisma.marketDataCandle.count({ where: { symbol } });
    console.log(`Total ${symbol} candles in DB: ${total}`);

    // Show sample for verification
    const sample = await prisma.marketDataCandle.findMany({
        where: { symbol, resolution },
        orderBy: { time: 'asc' },
        take: 3,
    });
    console.log('\nFirst 3 candles:');
    sample.forEach(c => console.log(`  ${c.time.toISOString()} O:${c.open} H:${c.high} L:${c.low} C:${c.close} V:${c.volume}`));
}

seed().catch(console.error).finally(() => prisma.$disconnect());
