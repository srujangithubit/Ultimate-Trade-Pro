import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { Client } from 'pg';

const BATCH_SIZE = 10_000;
const CSV_FOLDER = path.resolve(process.cwd(), 'Candle data');
const BROKER_TIME_OFFSET_MINUTES = parseInt(
  process.env.BROKER_TIME_OFFSET_MINUTES || '0',
  10,
);

interface CandleRow {
  symbol: string;
  resolution: string;
  time: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

// Parse MT5 time format: "2020.01.02 00:00:00"
function parseMT5Time(raw: string): Date | null {
  const match = raw
    .trim()
    .match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);

  if (!match) return null;

  const [
    _full,
    year,
    month,
    day,
    hour,
    minute,
    second,
  ] = match;

  // MT5 timestamps are broker-local time. Convert them to UTC using
  // the configured broker offset (for example: broker UTC+2 => 120).
  const brokerEpochMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );

  const utcEpochMs = brokerEpochMs - BROKER_TIME_OFFSET_MINUTES * 60 * 1000;
  const d = new Date(utcEpochMs);
  return isNaN(d.getTime()) ? null : d;
}

// Parse filename: XAUUSD_M1_2019_2026.csv → { symbol: 'XAUUSD', resolution: '1' }
function parseFilename(
  filename: string,
): { symbol: string; resolution: string } | null {
  const base = path.basename(filename, '.csv');
  const parts = base.split('_');
  if (parts.length < 2) return null;
  const symbol = parts[0];
  const mt5Resolution = parts[1];
  const resolutionMap: Record<string, string> = {
    M1: '1',
    M5: '5',
    M15: '15',
    M30: '30',
    H1: '60',
    H4: '240',
    D1: '1440',
    W1: '10080',
    MN1: '43200',
  };
  const resolution = resolutionMap[mt5Resolution];
  if (!resolution) return null;
  return { symbol, resolution };
}

// Batch insert using parameterized INSERT with ON CONFLICT DO NOTHING
// Sub-batches of 500 rows to stay within PostgreSQL parameter limits
async function writeBatch(client: Client, rows: CandleRow[]): Promise<number> {
  const SUB_BATCH = 500;
  let totalInserted = 0;

  for (let i = 0; i < rows.length; i += SUB_BATCH) {
    const chunk = rows.slice(i, i + SUB_BATCH);
    await client.query('BEGIN');
    try {
      const values: string[] = [];
      const params: string[] = [];
      let paramIdx = 1;

      for (const r of chunk) {
        values.push(
          `(gen_random_uuid(), $${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}, $${paramIdx + 7})`,
        );
        params.push(
          r.symbol,
          r.resolution,
          r.time.toISOString(),
          r.open,
          r.high,
          r.low,
          r.close,
          r.volume,
        );
        paramIdx += 8;
      }

      const result = await client.query(
        `
        INSERT INTO "MarketDataCandle" (id, symbol, resolution, time, open, high, low, close, volume)
        VALUES ${values.join(',\n')}
        ON CONFLICT (symbol, resolution, time) DO NOTHING
      `,
        params,
      );

      await client.query('COMMIT');
      totalInserted += result.rowCount ?? 0;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }

  return totalInserted;
}

async function importFile(
  client: Client,
  filePath: string,
  meta: { symbol: string; resolution: string },
): Promise<{ totalProcessed: number; totalInserted: number }> {
  return new Promise((resolve, reject) => {
    let batch: CandleRow[] = [];
    let totalProcessed = 0;
    let totalInserted = 0;
    let batchIndex = 0;
    let lineNumber = 0;
    const pendingBatches: Promise<void>[] = [];

    const stream = fs.createReadStream(filePath).pipe(
      csv({
        headers: [
          'time',
          'open',
          'high',
          'low',
          'close',
          'tick_volume',
          'spread',
          'real_volume',
        ],
      }),
    );

    stream.on('data', (row: Record<string, string>) => {
      lineNumber++;
      const parsedTime = parseMT5Time(row.time);
      if (!parsedTime) {
        console.warn(
          `  [WARN] ${path.basename(filePath)} line ${lineNumber}: unparseable time "${row.time}" — skipping`,
        );
        return;
      }
      const open = parseFloat(row.open);
      const high = parseFloat(row.high);
      const low = parseFloat(row.low);
      const close = parseFloat(row.close);
      const volume = parseFloat(row.tick_volume);
      if ([open, high, low, close, volume].some(isNaN)) {
        console.warn(
          `  [WARN] ${path.basename(filePath)} line ${lineNumber}: invalid numeric value — skipping`,
        );
        return;
      }

      batch.push({
        symbol: meta.symbol,
        resolution: meta.resolution,
        time: parsedTime,
        open: open.toFixed(8),
        high: high.toFixed(8),
        low: low.toFixed(8),
        close: close.toFixed(8),
        volume: volume.toFixed(8),
      });
      totalProcessed++;

      if (batch.length >= BATCH_SIZE) {
        const currentBatch = [...batch];
        const currentIndex = ++batchIndex;
        batch = [];
        stream.pause();

        const batchPromise = writeBatch(client, currentBatch)
          .then((inserted) => {
            totalInserted += inserted;
            console.log(
              `  ${meta.symbol} ${meta.resolution}: batch ${currentIndex} — ${inserted} inserted, ${totalProcessed} rows processed`,
            );
            stream.resume();
          })
          .catch((err) => {
            console.error(
              `  [ERROR] batch ${currentIndex} failed: ${(err as Error).message}`,
            );
            stream.resume();
          });
        pendingBatches.push(batchPromise);
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    stream.on('end', async () => {
      // Flush remaining rows
      if (batch.length > 0) {
        try {
          const inserted = await writeBatch(client, batch);
          totalInserted += inserted;
          console.log(
            `  ${meta.symbol} ${meta.resolution}: final batch — ${inserted} inserted, ${totalProcessed} rows processed`,
          );
        } catch (err) {
          console.error(
            `  [ERROR] final batch failed: ${(err as Error).message}`,
          );
        }
      }
      await Promise.all(pendingBatches);
      resolve({ totalProcessed, totalInserted });
    });

    stream.on('error', reject);
  });
}

let shuttingDown = false;

async function main() {
  const startTime = Date.now();
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Handle SIGINT gracefully
  process.on('SIGINT', () => {
    if (shuttingDown) {
      console.log('\nForce exit.');
      process.exit(1);
    }
    shuttingDown = true;
    console.log('\nSIGINT received — finishing current batch then exiting...');
  });

  // Enable gen_random_uuid if not already available
  await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  if (!fs.existsSync(CSV_FOLDER)) {
    console.error(`CSV folder not found: ${CSV_FOLDER}`);
    console.error(
      'Create a "Candle data" folder in the project root and place MT5 CSV exports there.',
    );
    process.exit(1);
  }

  const files = fs.readdirSync(CSV_FOLDER).filter((f) => f.endsWith('.csv'));
  if (files.length === 0) {
    console.error(`No CSV files found in ${CSV_FOLDER}`);
    process.exit(1);
  }

  console.log(`Found ${files.length} CSV files. Starting import...\n`);
  console.log(
    `Using BROKER_TIME_OFFSET_MINUTES=${BROKER_TIME_OFFSET_MINUTES} for broker-time -> UTC conversion`,
  );

  const summary: { file: string; processed: number; inserted: number }[] = [];

  for (const file of files) {
    if (shuttingDown) {
      console.log(`\n[ABORT] Shutting down — skipping remaining files.`);
      break;
    }

    const meta = parseFilename(file);
    if (!meta) {
      console.warn(
        `[SKIP] Cannot parse symbol/resolution from filename: ${file}`,
      );
      continue;
    }
    const filePath = path.join(CSV_FOLDER, file);
    console.log(
      `\n[START] ${file} → symbol=${meta.symbol} resolution=${meta.resolution}`,
    );
    const fileStart = Date.now();

    try {
      const { totalProcessed, totalInserted } = await importFile(
        client,
        filePath,
        meta,
      );
      const elapsed = ((Date.now() - fileStart) / 1000).toFixed(1);
      console.log(
        `[DONE]  ${file} — ${totalProcessed} processed, ${totalInserted} inserted in ${elapsed}s`,
      );
      summary.push({
        file,
        processed: totalProcessed,
        inserted: totalInserted,
      });
    } catch (err) {
      console.error(`[FAIL]  ${file} — ${(err as Error).message}`);
    }
  }

  // Update PostgreSQL planner statistics
  console.log('\nRunning ANALYZE on "MarketDataCandle"...');
  await client.query('ANALYZE "MarketDataCandle"');

  await client.end();

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n═══ IMPORT SUMMARY ═══');
  for (const s of summary) {
    console.log(
      `  ${s.file}: ${s.processed.toLocaleString()} processed, ${s.inserted.toLocaleString()} inserted`,
    );
  }
  const grandTotal = summary.reduce((a, s) => a + s.inserted, 0);
  console.log(
    `\nTotal inserted: ${grandTotal.toLocaleString()} rows in ${totalElapsed}s`,
  );
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
