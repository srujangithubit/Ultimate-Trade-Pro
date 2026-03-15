/**
 * Import only the Daily/Weekly/Monthly files that were skipped in the first run.
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const prisma = new PrismaClient();
const SOURCE_FOLDER = 'c:\\Users\\sruja.SUNNULINGEGOWDA\\Music\\Candle data';

const RESOLUTION_MAP = {
  'Daily': '1440',
  'Weekly': '10080',
  'Monthly': '43200',
};

function parseMT5Time(dateStr, timeStr) {
  const normalized = dateStr.trim().replace(/\./g, '-');
  const d = new Date(normalized + 'T' + timeStr.trim() + 'Z');
  return isNaN(d.getTime()) ? null : d;
}

async function importFile(filePath, symbol, resolution, tf) {
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let batch = [];
  let totalProcessed = 0;
  let totalInserted = 0;
  let lineNum = 0;

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1 && line.includes('<DATE>')) continue;
    if (!line.trim()) continue;

    const cols = line.split('\t');
    if (cols.length < 6) continue;

    // No TIME column: DATE  OPEN  HIGH  LOW  CLOSE  TICKVOL  VOL  SPREAD
    const time = parseMT5Time(cols[0], '00:00:00');
    if (!time) continue;

    const open = parseFloat(cols[1]);
    const high = parseFloat(cols[2]);
    const low = parseFloat(cols[3]);
    const close = parseFloat(cols[4]);
    const tickVol = parseFloat(cols[5]);
    if ([open, high, low, close].some(isNaN)) continue;

    batch.push({ symbol, resolution, time, open, high, low, close, volume: isNaN(tickVol) ? 0 : tickVol });
    totalProcessed++;

    if (batch.length >= 500) {
      const r = await prisma.marketDataCandle.createMany({ data: batch, skipDuplicates: true });
      totalInserted += r.count;
      batch = [];
    }
  }

  if (batch.length > 0) {
    const r = await prisma.marketDataCandle.createMany({ data: batch, skipDuplicates: true });
    totalInserted += r.count;
  }

  console.log(`  ${symbol} ${tf}: ${totalProcessed} processed, ${totalInserted} inserted`);
  return totalInserted;
}

async function main() {
  console.log('Importing Daily/Weekly/Monthly candles...\n');
  let total = 0;

  const symbolFolders = fs.readdirSync(SOURCE_FOLDER).filter(f =>
    fs.statSync(path.join(SOURCE_FOLDER, f)).isDirectory()
  );

  for (const folder of symbolFolders) {
    const folderPath = path.join(SOURCE_FOLDER, folder);
    const csvs = fs.readdirSync(folderPath).filter(f => f.endsWith('.csv'));
    for (const csv of csvs) {
      const base = path.basename(csv, '.csv');
      const parts = base.split('_');
      const tf = parts[1];
      const resolution = RESOLUTION_MAP[tf];
      if (!resolution) continue; // skip intraday files
      const inserted = await importFile(path.join(folderPath, csv), parts[0], resolution, tf);
      total += inserted;
    }
  }

  console.log(`\nDone! Inserted ${total} candles.`);
  const finalCount = await prisma.marketDataCandle.count();
  console.log(`Database total: ${finalCount.toLocaleString()} candles`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
