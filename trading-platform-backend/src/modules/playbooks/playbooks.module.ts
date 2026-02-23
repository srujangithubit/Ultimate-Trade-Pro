import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaybooksService } from './playbooks.service';
import { PlaybooksController } from './playbooks.controller';
import { Playbook } from './entities/playbook.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Playbook])],
    controllers: [PlaybooksController],
    providers: [PlaybooksService],
    exports: [PlaybooksService],
})
export class PlaybooksModule { }
