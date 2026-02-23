import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradesService } from './trades.service';
import { TradesController } from './trades.controller';
import { Trade } from './entities/trade.entity';
import { CsvParserService } from './parsers/csv-parser.service';

@Module({
  imports: [TypeOrmModule.forFeature([Trade])],
  controllers: [TradesController],
  providers: [TradesService, CsvParserService],
  exports: [TradesService],
})
export class TradesModule {}
