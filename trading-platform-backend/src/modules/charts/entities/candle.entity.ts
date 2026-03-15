import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    Index,
    Unique,
} from 'typeorm';

@Entity('chart_candles')
@Unique(['symbol', 'timeframe', 'time'])
@Index(['symbol', 'timeframe', 'time'])
export class CandleEntity {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id: string;

    @Column({ type: 'varchar', length: 20 })
    symbol: string;

    @Column({ type: 'varchar', length: 10 })
    timeframe: string;

    @Column({ type: 'decimal', precision: 18, scale: 5 })
    open: string;

    @Column({ type: 'decimal', precision: 18, scale: 5 })
    high: string;

    @Column({ type: 'decimal', precision: 18, scale: 5 })
    low: string;

    @Column({ type: 'decimal', precision: 18, scale: 5 })
    close: string;

    @Column({ type: 'decimal', precision: 18, scale: 2 })
    volume: string;

    @Column({ type: 'timestamp with time zone' })
    time: Date;
}
