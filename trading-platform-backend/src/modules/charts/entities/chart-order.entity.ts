import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

export type ChartOrderSide = 'buy' | 'sell';
export type ChartOrderType = 'market' | 'limit' | 'stop';
export type ChartOrderStatus =
    | 'pending'
    | 'filled'
    | 'partially_filled'
    | 'cancelled'
    | 'rejected'
    | 'expired';

@Entity('chart_orders')
@Index(['accountId', 'status'])
@Index(['symbol'])
export class ChartOrderEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 64 })
    accountId: string;

    @Column({ type: 'varchar', length: 20 })
    symbol: string;

    @Column({ type: 'varchar', length: 10 })
    side: ChartOrderSide;

    @Column({ type: 'varchar', length: 10 })
    type: ChartOrderType;

    @Column({ type: 'decimal', precision: 18, scale: 5 })
    volume: string;

    @Column({ type: 'decimal', precision: 18, scale: 5, nullable: true })
    price: string | null;

    @Column({ type: 'decimal', precision: 18, scale: 5, nullable: true })
    sl: string | null;

    @Column({ type: 'decimal', precision: 18, scale: 5, nullable: true })
    tp: string | null;

    @Column({ type: 'varchar', length: 20, default: 'pending' })
    status: ChartOrderStatus;

    @Column({ type: 'timestamp with time zone', nullable: true })
    filledAt: Date | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    createdAt: Date;
}
