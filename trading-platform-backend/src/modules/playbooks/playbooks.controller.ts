import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlaybooksService } from './playbooks.service';
import { CreatePlaybookDto } from './dto/create-playbook.dto';
import { UpdatePlaybookDto } from './dto/update-playbook.dto';

@Controller('playbooks')
@UseGuards(JwtAuthGuard)
export class PlaybooksController {
    constructor(private readonly playbooksService: PlaybooksService) { }

    @Post()
    create(@Request() req, @Body() createPlaybookDto: CreatePlaybookDto) {
        createPlaybookDto.userId = req.user.id;
        return this.playbooksService.create(createPlaybookDto);
    }

    @Get()
    findAll(@Request() req) {
        return this.playbooksService.findAll(req.user.id);
    }

    @Get(':id')
    findOne(@Request() req, @Param('id') id: string) {
        return this.playbooksService.findOne(id, req.user.id);
    }

    @Patch(':id')
    update(@Request() req, @Param('id') id: string, @Body() updatePlaybookDto: UpdatePlaybookDto) {
        return this.playbooksService.update(id, req.user.id, updatePlaybookDto);
    }

    @Delete(':id')
    remove(@Request() req, @Param('id') id: string) {
        return this.playbooksService.remove(id, req.user.id);
    }
}
