/**
 * Import real MT5 candle data from CSV files into PostgreSQL.
 * 
 * Handles:
 *   - Tab-separated MT5 CSV export format
 *   - Subfolder-per-symbol layout (XAUUSD/, EURUSD/, etc.)
 *   - All timeframes: M1, M5, M10, M15, M30, H1, H4, Daily, Weekly, Monthly
 * 
 * Usage: node import_real_candles.js [source_folder]
 *   Default source: c:\Users\sruja.SUNNULINGEGOWDA\Music\Candle data
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const prisma = new PrismaClient();

const SOURCE_FOLDER = process.argv[2] || 'c:\\Users\\sruja.SUNNULINGEGOWDA\\Music\\Candle data';

// Map MT5 timeframe names to resolution values
const RESOLUTION_MAP = {
  'M1': '1',
  'M5': '5',
  'M10': '10',
  'M15': '15',
  'M30': '30',
  'H1': '60',
  'H4': '240',
  'Daily': '1440',
  'Weekly': '10080',
  'Monthly': '43200',
};

function parseFilename(filename) {
  // e.g. XAUUSD_H1_201901020600_202602272300.csv
  // or   XAUUSD_M1_2019-01020600_2026-02272359.csv
  const base = path.basename(filename, '.csv');
  const parts = base.split('_');
  if (parts.length < 2) return null;
  const symbol = parts[0];
  const tf = parts[1];
  const resolution = RESOLUTION_MAP[tf];
  if (!resolution) {
    console.warn(`  Unknown timeframe "${tf}" in ${filename}, skipping`);
    return null;
  }
  return { symbol, resolution, timeframe: tf };
}

function parseMT5Time(dateStr, timeStr) {
  // "2019.01.02" + "06:00:00" → UTC Date
  const normalized = dateStr.trim().replace(/\./g, '-');
  const d = new Date(normalized + 'T' + timeStr.trim() + 'Z');
  return isNaN(d.getTime()) ? null : d;
}

async function importFile(filePath, meta) {
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const BATCH_SIZE = 2000;
  let batch = [];
  let totalProcessed = 0;
  let totalInserted = 0;
  let lineNum = 0;
  let skipped = 0;
  let hasTimeCol = true; // default, detected from header

  for await (const line of rl) {
    lineNum++;
    // Skip header
    if (lineNum === 1 && line.includes('<DATE>')) {
      // Detect if this file has a TIME column
      hasTimeCol = line.includes('<TIME>');
      continue;
    }
    if (!line.trim()) continue;

    const cols = line.split('\t');
    
    let time, open, high, low, close, tickVol;
    if (hasTimeCol) {
      // Intraday format: DATE  TIME  OPEN  HIGH  LOW  CLOSE  TICKVOL  VOL  SPREAD
      if (cols.length < 7) { skipped++; continue; }
      time = parseMT5Time(cols[0], cols[1]);
      open = parseFloat(cols[2]);
      high = parseFloat(cols[3]);
      low = parseFloat(cols[4]);
      close = parseFloat(cols[5]);
      tickVol = parseFloat(cols[6]);
    } else {
      // Daily/Weekly/Monthly: DATE  OPEN  HIGH  LOW  CLOSE  TICKVOL  VOL  SPREAD
      if (cols.length < 6) { skipped++; continue; }
      time = parseMT5Time(cols[0], '00:00:00');
      open = parseFloat(cols[1]);
      high = parseFloat(cols[2]);
      low = parseFloat(cols[3]);
      close = parseFloat(cols[4]);
      tickVol = parseFloat(cols[5]);
    }

    if ([open, high, low, close].some(isNaN)) {
      skipped++;
      continue;
    }

    batch.push({
      symbol: meta.symbol,
      resolution: meta.resolution,
      time,
      open,
      high,
      low,
      close,
      volume: isNaN(tickVol) ? 0 : tickVol,
    });
    totalProcessed++;

    if (batch.length >= BATCH_SIZE) {
      const inserted = await insertBatch(batch);
      totalInserted += inserted;
      batch = [];
      process.stdout.write(`\r  ${meta.symbol} ${meta.timeframe}: ${totalProcessed.toLocaleString()} rows processed, ${totalInserted.toLocaleString()} inserted`);
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    const inserted = await insertBatch(batch);
    totalInserted += inserted;
  }

  return { totalProcessed, totalInserted, skipped };
}

async function insertBatch(rows) {
  try {
    const result = await prisma.marketDataCandle.createMany({
      data: rows,
      skipDuplicates: true,
    });
    return result.count;
  } catch (err) {
    // Fallback: insert one-by-one on error
    let count = 0;
    for (const row of rows) {
      try {
        await prisma.marketDataCandle.create({ data: row });
        count++;
      } catch {
        // duplicate or other error, skip
      }
    }
    return count;
  }
}

async function main() {
  console.log(`\n=== Real MT5 Candle Data Importer ===`);
  console.log(`Source: ${SOURCE_FOLDER}\n`);

  if (!fs.existsSync(SOURCE_FOLDER)) {
    console.error(`Source folder not found: ${SOURCE_FOLDER}`);
    process.exit(1);
  }

  // First, clear fake seeded data
  const existingCount = await prisma.marketDataCandle.count();
  if (existingCount > 0) {
    console.log(`Clearing ${existingCount.toLocaleString()} existing candles...`);
    await prisma.marketDataCandle.deleteMany({});
    console.log('Cleared.\n');
  }

  // Discover all CSV files in subfolders
  const symbolFolders = fs.readdirSync(SOURCE_FOLDER).filter(f => {
    return fs.statSync(path.join(SOURCE_FOLDER, f)).isDirectory();
  });

  const allFiles = [];
  for (const folder of symbolFolders) {
    const folderPath = path.join(SOURCE_FOLDER, folder);
    const csvs = fs.readdirSync(folderPath).filter(f => f.endsWith('.csv'));
    for (const csv of csvs) {
      const meta = parseFilename(csv);
      if (meta) {
        allFiles.push({ path: path.join(folderPath, csv), meta, filename: csv });
      }
    }
  }

  console.log(`Found ${allFiles.length} CSV files across ${symbolFolders.length} symbols: ${symbolFolders.join(', ')}\n`);

  // Sort: import smaller timeframes last (they're biggest), do Daily/Weekly/Monthly first
  const tfOrder = { '43200': 0, '10080': 1, '1440': 2, '240': 3, '60': 4, '30': 5, '15': 6, '10': 7, '5': 8, '1': 9 };
  allFiles.sort((a, b) => (tfOrder[a.meta.resolution] ?? 99) - (tfOrder[b.meta.resolution] ?? 99));

  const startTime = Date.now();
  let grandTotal = 0;
  const summary = [];

  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i];
    const fileSize = (fs.statSync(file.path).size / (1024 * 1024)).toFixed(1);
    console.log(`\n[${i + 1}/${allFiles.length}] ${file.filename} (${fileSize} MB)`);

    const result = await importFile(file.path, file.meta);
    grandTotal += result.totalInserted;
    summary.push({
      file: file.filename,
      symbol: file.meta.symbol,
      tf: file.meta.timeframe,
      processed: result.totalProcessed,
      inserted: result.totalInserted,
      skipped: result.skipped,
    });
    console.log(`\r  ${file.meta.symbol} ${file.meta.timeframe}: ${result.totalProcessed.toLocaleString()} processed, ${result.totalInserted.toLocaleString()} inserted, ${result.skipped} skipped`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n\n=== Import Complete ===`);
  console.log(`Total candles inserted: ${grandTotal.toLocaleString()}`);
  console.log(`Time: ${elapsed}s\n`);

  // Print summary by symbol
  const bySymbol = {};
  for (const s of summary) {
    if (!bySymbol[s.symbol]) bySymbol[s.symbol] = { total: 0, timeframes: [] };
    bySymbol[s.symbol].total += s.inserted;
    bySymbol[s.symbol].timeframes.push(`${s.tf}(${s.inserted.toLocaleString()})`);
  }
  for (const [sym, data] of Object.entries(bySymbol)) {
    console.log(`  ${sym}: ${data.total.toLocaleString()} candles — ${data.timeframes.join(', ')}`);
  }

  // Verify
  const finalCount = await prisma.marketDataCandle.count();
  console.log(`\nDatabase total: ${finalCount.toLocaleString()} candles`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
