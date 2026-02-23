import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlaybookDto, UpdatePlaybookDto } from './dto/playbook.dto';

@Injectable()
export class PlaybooksService {
    constructor(private prisma: PrismaService) { }

    async findAll(userId: string) {
        const playbooks = await this.prisma.playbook.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { trades: true }
                }
            }
        });

        // Map to include totalTrades, winRate, avgRR based on trades (mocking calculation for now if no trades exist)
        // Since we are not doing a full aggregation of trades here yet, we'll return 0 for complex stats
        return playbooks.map(pb => ({
            ...pb,
            totalTrades: pb._count.trades,
            winRate: 0, // Placeholder until full analytics are built
            avgRR: 0,   // Placeholder until full analytics are built
            rules: (pb.rules as string[]) || [],
            tags: (pb.tags as string[]) || []
        }));
    }

    async findOne(userId: string, id: string) {
        const playbook = await this.prisma.playbook.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { trades: true }
                }
            }
        });

        if (!playbook) throw new NotFoundException('Playbook not found');
        if (playbook.userId !== userId) throw new ForbiddenException('Access denied');

        return {
            ...playbook,
            totalTrades: playbook._count.trades,
            winRate: 0,
            avgRR: 0,
            rules: (playbook.rules as string[]) || [],
            tags: (playbook.tags as string[]) || []
        };
    }

    async create(userId: string, dto: CreatePlaybookDto) {
        return this.prisma.playbook.create({
            data: {
                userId,
                name: dto.name,
                description: dto.description || null,
                rules: dto.rules || [],
                tags: dto.tags || [],
            },
        });
    }

    async update(userId: string, id: string, dto: UpdatePlaybookDto) {
        await this.findOne(userId, id); // validates ownership and existence

        return this.prisma.playbook.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.rules !== undefined && { rules: dto.rules }),
                ...(dto.tags !== undefined && { tags: dto.tags }),
            },
        });
    }

    async remove(userId: string, id: string) {
        await this.findOne(userId, id);

        return this.prisma.playbook.delete({
            where: { id },
        });
    }
}
