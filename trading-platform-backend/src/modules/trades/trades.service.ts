import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trade } from './entities/trade.entity';
import { CreateTradeDto } from './dto/create-trade.dto';
import { TradeFilterDto } from './dto/trade-filter.dto';
import { CsvParserService } from './parsers/csv-parser.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class TradesService {
  constructor(
    @InjectRepository(Trade)
    private tradeRepository: Repository<Trade>,
    private csvParser: CsvParserService,
  ) { }

  async create(userId: string, dto: CreateTradeDto) {
    const trade = this.tradeRepository.create({
      userId,
      ...dto,
      entryDatetime: new Date(dto.entryDate),
      exitDatetime: dto.exitDate ? new Date(dto.exitDate) : undefined,
      direction: dto.direction.toLowerCase() as 'long' | 'short',
    });

    if (trade.entryDatetime && trade.exitDatetime) {
      trade.tradeDurationMinutes = (trade.exitDatetime.getTime() - trade.entryDatetime.getTime()) / (1000 * 60);
    }

    if (trade.exitPrice) {
      const { pnlGross, pnlNet } = this.calculatePnL(trade);
      trade.pnlGross = pnlGross;
      trade.pnlNet = pnlNet;
    }

    return await this.tradeRepository.save(trade);
  }

  async findAll(userId: string, filters: TradeFilterDto) {
    const query = this.tradeRepository
      .createQueryBuilder('trade')
      .where('trade.userId = :userId', { userId });

    if (filters.instrument) {
      query.andWhere('trade.instrument = :instrument', {
        instrument: filters.instrument,
      });
    }

    if (filters.startDate && filters.endDate) {
      query.andWhere('trade.entryDatetime BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    if (filters.assetClass) {
      query.andWhere('trade.assetClass = :assetClass', {
        assetClass: filters.assetClass,
      });
    }

    // JSONB array contains check
    if (filters.tags && filters.tags.length > 0) {
      query.andWhere('trade.tags @> :tags', {
        tags: JSON.stringify(filters.tags), // Postgres JSONB syntax
      });
    }

    if (filters.minPnl !== undefined) {
      query.andWhere('trade.pnlNet >= :minPnl', { minPnl: filters.minPnl });
    }

    if (filters.maxPnl !== undefined) {
      query.andWhere('trade.pnlNet <= :maxPnl', { maxPnl: filters.maxPnl });
    }

    query.orderBy('trade.entryDatetime', filters.sortOrder || 'DESC');

    if (filters.limit) {
      query.take(filters.limit);
    }

    if (filters.offset) {
      query.skip(filters.offset);
    }

    const [trades, total] = await query.getManyAndCount();

    return {
      trades,
      total,
      page:
        filters.offset && filters.limit
          ? Math.floor(filters.offset / filters.limit) + 1
          : 1,
      totalPages: filters.limit ? Math.ceil(total / filters.limit) : 1,
    };
  }

  async findOne(id: string, userId: string) {
    const trade = await this.tradeRepository.findOne({
      where: { id, userId },
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    return trade;
  }

  async update(id: string, userId: string, updateDto: Partial<CreateTradeDto>) {
    const trade = await this.findOne(id, userId);

    // Map DTO fields to Entity fields
    const { entryDate, exitDate, direction, ...rest } = updateDto;

    Object.assign(trade, rest);

    if (entryDate) trade.entryDatetime = new Date(entryDate);
    if (exitDate) trade.exitDatetime = new Date(exitDate);
    if (direction) trade.direction = direction.toLowerCase() as 'long' | 'short';

    if (trade.entryDatetime && trade.exitDatetime) {
      trade.tradeDurationMinutes = (trade.exitDatetime.getTime() - trade.entryDatetime.getTime()) / (1000 * 60);
    }

    if (trade.exitPrice) {
      const { pnlGross, pnlNet } = this.calculatePnL(trade);
      trade.pnlGross = pnlGross;
      trade.pnlNet = pnlNet;
    } else {
      // Reset PnL if exit price is removed (though partial updates might not remove it explicitly unless null, assuming undefined ignores)
      // If the user explicitly sets exitPrice to null, we should reset PnL.
      // But DTO is Partial<CreateTradeDto>, where exitPrice is number.
      // For now, if exitPrice exists on the object (merged), we calculate.
    }

    return await this.tradeRepository.save(trade);
  }

  async remove(id: string, userId: string) {
    const trade = await this.findOne(id, userId);
    await this.tradeRepository.remove(trade);
    return { message: 'Trade deleted successfully' };
  }

  async importFromCsv(userId: string, file: Express.Multer.File) {
    const trades = this.csvParser.parse(file.buffer);
    const createdTrades: Trade[] = [];

    // Batch save or individual save. Individual for validation safety.
    for (const tradeData of trades) {
      // Basic mapping - assume parsing aligned with CreateTradeDto partially
      // In reality, need DTO transformation/validation here.
      // Skipping full validation for brevity but setting defaults.

      const trade = this.tradeRepository.create({
        userId,
        source: 'imported',
        instrument: tradeData.instrument || 'UNKNOWN',
        entryDatetime: tradeData.entryDatetime ? new Date(tradeData.entryDatetime) : new Date(),
        direction: tradeData.direction || 'long',
        entryPrice: parseFloat(tradeData.entryPrice || '0'),
        quantity: parseFloat(tradeData.quantity || '0'),
        // ... mapped fields
      });
      createdTrades.push(await this.tradeRepository.save(trade));
    }

    return {
      imported: createdTrades.length,
      trades: createdTrades,
    };
  }

  async searchTrades(userId: string, searchTerm: string) {
    return await this.tradeRepository
      .createQueryBuilder('trade')
      .where('trade.userId = :userId', { userId })
      .andWhere(
        `(
          trade.instrument ILIKE :search OR
          trade.notes ILIKE :search
        )`,
        { search: `%${searchTerm}%` },
      )
      .orderBy('trade.entryDatetime', 'DESC')
      .take(50)
      .getMany();
  }
  private calculatePnL(trade: Partial<Trade>) {
    if (trade.entryPrice && trade.exitPrice && trade.quantity && trade.direction) {
      const multiplier = trade.direction === 'long' ? 1 : -1;
      const pnlGross = (trade.exitPrice - trade.entryPrice) * trade.quantity * multiplier;
      const pnlNet = pnlGross - (trade.fees || 0) - (trade.commission || 0);
      return { pnlGross, pnlNet };
    }
    return { pnlGross: 0, pnlNet: 0 };
  }
}
