import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { TradesService } from './trades.service';
import { CreateTradeDto } from './dto/create-trade.dto';
import { UpdateTradeDto } from './dto/update-trade.dto';
import { JwtGuard } from '../auth/guard';
import { GetUser } from '../auth/decorator';

@UseGuards(JwtGuard)
@Controller('trades')
export class TradesController {
  constructor(private readonly tradesService: TradesService) { }

  @Post()
  async create(@GetUser('id') userId: string, @Body() createTradeDto: CreateTradeDto) {
    return this.tradesService.create(userId, createTradeDto);
  }

  @Get()
  async findAll(@GetUser('id') userId: string) {
    return this.tradesService.findAll(userId);
  }

  @Get(':id')
  findOne(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.tradesService.findOne(userId, id);
  }

  @Patch(':id')
  update(@GetUser('id') userId: string, @Param('id') id: string, @Body() updateTradeDto: UpdateTradeDto) {
    return this.tradesService.update(userId, id, updateTradeDto);
  }

  @Delete(':id')
  remove(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.tradesService.remove(userId, id);
  }
}
