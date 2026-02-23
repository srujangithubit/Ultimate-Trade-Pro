import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePlaybookDto } from './dto/create-playbook.dto';
import { UpdatePlaybookDto } from './dto/update-playbook.dto';
import { Playbook } from './entities/playbook.entity';

@Injectable()
export class PlaybooksService {
    constructor(
        @InjectRepository(Playbook)
        private readonly playbooksRepository: Repository<Playbook>,
    ) { }

    async create(createPlaybookDto: CreatePlaybookDto): Promise<Playbook> {
        try {
            console.log('Creating playbook:', createPlaybookDto);
            const playbook = this.playbooksRepository.create(createPlaybookDto);
            const saved = await this.playbooksRepository.save(playbook);
            console.log('Successfully saved playbook:', saved);
            return saved;
        } catch (error) {
            console.error('Error creating playbook:', error);
            throw error;
        }
    }

    async findAll(userId: string): Promise<Playbook[]> {
        return await this.playbooksRepository.find({ where: { userId } });
    }

    async findOne(id: string, userId: string): Promise<Playbook> {
        const playbook = await this.playbooksRepository.findOne({ where: { id, userId } });
        if (!playbook) {
            throw new NotFoundException(`Playbook with ID "${id}" not found`);
        }
        return playbook;
    }

    async update(id: string, userId: string, updatePlaybookDto: UpdatePlaybookDto): Promise<Playbook> {
        const playbook = await this.findOne(id, userId);
        const updated = Object.assign(playbook, updatePlaybookDto);
        return await this.playbooksRepository.save(updated);
    }

    async remove(id: string, userId: string): Promise<void> {
        const playbook = await this.findOne(id, userId);
        await this.playbooksRepository.remove(playbook);
    }
}
