import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    Index,
} from 'typeorm';

export type ChartPositionSide = 'buy' | 'sell';

@Entity('chart_positions')
@Index(['accountId', 'closedAt'])
@Index(['symbol'])
export class ChartPositionEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 64 })
    accountId: string;

    @Column({ type: 'varchar', length: 20 })
    symbol: string;

    @Column({ type: 'varchar', length: 10 })
    side: ChartPositionSide;

    @Column({ type: 'decimal', precision: 18, scale: 5 })
    volume: string;

    @Column({ type: 'decimal', precision: 18, scale: 5 })
    openPrice: string;

    @Column({ type: 'decimal', precision: 18, scale: 5 })
    currentPrice: string;

    @Column({ type: 'decimal', precision: 18, scale: 5, nullable: true })
    sl: string | null;

    @Column({ type: 'decimal', precision: 18, scale: 5, nullable: true })
    tp: string | null;

    @Column({ type: 'decimal', precision: 18, scale: 5, default: '0' })
    pnl: string;

    @Column({ type: 'timestamp with time zone' })
    openedAt: Date;

    @Column({ type: 'timestamp with time zone', nullable: true })
    closedAt: Date | null;
}
