import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

@Injectable()
export class CsvParserService {
  parse(buffer: Buffer): any[] {
    const content = buffer.toString('utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    // Map CSV columns to Trade entity fields - primitive mapping
    return records.map((record: any) => ({
      instrument: record.Symbol || record.Instrument,
      direction: (record.Side || record.Action || '')
        .toLowerCase()
        .includes('buy')
        ? 'long'
        : 'short',
      entryDatetime: new Date(record.Date || record.Time || Date.now()),
      ...record,
    }));
  }
}
