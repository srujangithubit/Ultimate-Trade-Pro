import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    Index,
} from 'typeorm';

@Entity('chart_strategy_logs')
@Index(['symbol', 'timestamp'])
export class StrategyLogEntity {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id: string;

    @Column({ type: 'varchar', length: 20 })
    symbol: string;

    @Column({ type: 'varchar', length: 10 })
    timeframe: string;

    @Column({ type: 'varchar', length: 20 })
    signal: string;

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    confidence: string;

    @Column({ type: 'timestamp with time zone' })
    timestamp: Date;
}
