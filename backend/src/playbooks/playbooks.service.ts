import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlaybookDto, UpdatePlaybookDto } from './dto/playbook.dto';

@Injectable()
export class PlaybooksService {
    constructor(private prisma: PrismaService) { }

    async findAll(userId: string) {
        // Fetch playbooks and all closed trades in parallel
        const [playbooks, trades] = await Promise.all([
            this.prisma.playbook.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.trade.findMany({
                where: { userId, status: 'CLOSED' },
                select: {
                    setup: true,
                    pnlNet: true,
                },
            }),
        ]);

        // Group trades by setup name (case-insensitive) for O(n) lookup
        const tradesBySetup = new Map<string, { pnlNet: number }[]>();
        for (const trade of trades) {
            if (!trade.setup) continue;
            const key = trade.setup.trim().toLowerCase();
            if (!tradesBySetup.has(key)) {
                tradesBySetup.set(key, []);
            }
            tradesBySetup.get(key)!.push({ pnlNet: Number(trade.pnlNet ?? 0) });
        }

        return playbooks.map(pb => {
            const key = pb.name.trim().toLowerCase();
            const matchingTrades = tradesBySetup.get(key) || [];
            const totalTrades = matchingTrades.length;

            let winRate = 0;
            let avgRR = 0;

            if (totalTrades > 0) {
                const wins = matchingTrades.filter(t => t.pnlNet > 0);
                const losses = matchingTrades.filter(t => t.pnlNet < 0);
                winRate = Math.round((wins.length / totalTrades) * 100);

                // avgRR = average winning P&L / average losing P&L (absolute value)
                if (wins.length > 0 && losses.length > 0) {
                    const avgWin = wins.reduce((sum, t) => sum + t.pnlNet, 0) / wins.length;
                    const avgLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnlNet, 0) / losses.length);
                    avgRR = avgLoss > 0 ? Math.round((avgWin / avgLoss) * 10) / 10 : 0;
                }
            }

            return {
                ...pb,
                totalTrades,
                winRate,
                avgRR,
                rules: (pb.rules as string[]) || [],
                tags: (pb.tags as string[]) || [],
            };
        });
    }

    async findOne(userId: string, id: string) {
        const playbook = await this.prisma.playbook.findUnique({
            where: { id },
        });

        if (!playbook) throw new NotFoundException('Playbook not found');
        if (playbook.userId !== userId) throw new ForbiddenException('Access denied');

        // Fetch matching closed trades by setup name (case-insensitive)
        const matchingTrades = await this.prisma.trade.findMany({
            where: {
                userId,
                status: 'CLOSED',
                setup: { equals: playbook.name, mode: 'insensitive' },
            },
            select: { pnlNet: true },
        });

        const totalTrades = matchingTrades.length;
        let winRate = 0;
        let avgRR = 0;

        if (totalTrades > 0) {
            const wins = matchingTrades.filter(t => Number(t.pnlNet ?? 0) > 0);
            const losses = matchingTrades.filter(t => Number(t.pnlNet ?? 0) < 0);
            winRate = Math.round((wins.length / totalTrades) * 100);

            if (wins.length > 0 && losses.length > 0) {
                const avgWin = wins.reduce((sum, t) => sum + Number(t.pnlNet ?? 0), 0) / wins.length;
                const avgLoss = Math.abs(losses.reduce((sum, t) => sum + Number(t.pnlNet ?? 0), 0) / losses.length);
                avgRR = avgLoss > 0 ? Math.round((avgWin / avgLoss) * 10) / 10 : 0;
            }
        }

        return {
            ...playbook,
            totalTrades,
            winRate,
            avgRR,
            rules: (playbook.rules as string[]) || [],
            tags: (playbook.tags as string[]) || [],
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
