import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { PlaybooksService } from './playbooks.service';
import { CreatePlaybookDto, UpdatePlaybookDto } from './dto/playbook.dto';
import { JwtGuard } from '../auth/guard';
import { GetUser } from '../auth/decorator';

@UseGuards(JwtGuard)
@Controller('playbooks')
export class PlaybooksController {
  constructor(private readonly playbooksService: PlaybooksService) {}

  @Post()
  create(
    @GetUser('id') userId: string,
    @Body() createPlaybookDto: CreatePlaybookDto,
  ) {
    return this.playbooksService.create(userId, createPlaybookDto);
  }

  @Get()
  findAll(@GetUser('id') userId: string) {
    return this.playbooksService.findAll(userId);
  }

  @Get(':id')
  findOne(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.playbooksService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @GetUser('id') userId: string,
    @Param('id') id: string,
    @Body() updatePlaybookDto: UpdatePlaybookDto,
  ) {
    return this.playbooksService.update(userId, id, updatePlaybookDto);
  }

  @Delete(':id')
  remove(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.playbooksService.remove(userId, id);
  }
}
