import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    Index,
    CreateDateColumn,
} from 'typeorm';

@Entity('chart_ticks')
@Index(['symbol', 'timestamp'])
export class TickEntity {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id: string;

    @Column({ type: 'varchar', length: 20 })
    symbol: string;

    @Column({ type: 'decimal', precision: 18, scale: 5 })
    bid: string;

    @Column({ type: 'decimal', precision: 18, scale: 5 })
    ask: string;

    @Column({ type: 'decimal', precision: 18, scale: 5 })
    last: string;

    @Column({ type: 'decimal', precision: 18, scale: 2 })
    volume: string;

    @Column({ type: 'timestamp with time zone' })
    timestamp: Date;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    createdAt: Date;
}
