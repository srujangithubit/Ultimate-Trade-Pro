import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  Put,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TradesService } from './trades.service';
import { CreateTradeDto } from './dto/create-trade.dto';
import { TradeFilterDto } from './dto/trade-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('trades')
@UseGuards(JwtAuthGuard)
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateTradeDto) {
    return this.tradesService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query() filters: TradeFilterDto) {
    // Transform filters if necessary (e.g. string numbers to number) if Pipes don't handle it
    // ValidationPipe with transform: true should handle DTO conversion
    return this.tradesService.findAll(user.id, filters);
  }

  @Get('search')
  search(@CurrentUser() user: any, @Query('q') query: string) {
    return this.tradesService.searchTrades(user.id, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tradesService.findOne(id, user.id);
  }

  @Put(':id')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: Partial<CreateTradeDto>,
  ) {
    return this.tradesService.update(id, user.id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tradesService.remove(id, user.id);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  importCsv(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.tradesService.importFromCsv(user.id, file);
  }
}
