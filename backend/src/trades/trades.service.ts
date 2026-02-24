import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTradeDto } from './dto/create-trade.dto';
import { UpdateTradeDto } from './dto/update-trade.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TradesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateTradeDto) {
    // If exit price is provided, calculate PnL and set status to CLOSED
    let status = 'OPEN';
    let pnlGross: number | null = null;
    let pnlNet: number | null = null;

    if (dto.exitPrice != null && dto.quantity) {
      status = 'CLOSED';
      const multiplier = dto.direction?.toUpperCase() === 'SHORT' ? -1 : 1;
      const calculatedGross =
        (dto.exitPrice - dto.entryPrice) * dto.quantity * multiplier;
      pnlGross = calculatedGross;
      pnlNet = calculatedGross - (dto.fees || 0);
    }

    const trade = await this.prisma.trade.create({
      data: {
        userId,
        accountId: dto.accountId,
        symbol: dto.symbol,
        direction: dto.direction,
        setup: dto.setup, // Map setup
        entryDate: new Date(dto.entryDate),
        exitDate: dto.exitDate ? new Date(dto.exitDate) : null,
        entryPrice: dto.entryPrice,
        exitPrice: dto.exitPrice,
        quantity: dto.quantity,
        fees: dto.fees || 0,
        notes: dto.notes,
        tags: dto.tags || [],
        status,
        pnlGross,
        pnlNet,
      },
    });
    return trade;
  }

  findAll(userId: string) {
    return this.prisma.trade.findMany({
      where: {
        userId,
      },
      orderBy: {
        entryDate: 'desc',
      },
    });
  }

  async findOne(userId: string, id: string) {
    const trade = await this.prisma.trade.findUnique({
      where: {
        id,
      },
    });

    if (!trade) throw new NotFoundException('Trade not found');
    if (trade.userId !== userId)
      throw new ForbiddenException('Access to trade denied');

    return trade;
  }

  async update(userId: string, id: string, dto: UpdateTradeDto) {
    // Check ownership first
    await this.findOne(userId, id);

    return this.prisma.trade.update({
      where: {
        id,
      },
      data: {
        ...dto,
        entryDate: dto.entryDate ? new Date(dto.entryDate) : undefined,
        exitDate: dto.exitDate ? new Date(dto.exitDate) : undefined,
      },
    });
  }

  async remove(userId: string, id: string) {
    // Check ownership
    await this.findOne(userId, id);

    return this.prisma.trade.delete({
      where: {
        id,
      },
    });
  }
}
