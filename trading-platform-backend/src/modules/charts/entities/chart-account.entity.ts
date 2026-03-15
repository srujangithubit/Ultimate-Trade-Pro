import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    UpdateDateColumn,
} from 'typeorm';

@Entity('chart_accounts')
export class ChartAccountEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'decimal', precision: 18, scale: 2, default: '0' })
    equity: string;

    @Column({ type: 'decimal', precision: 18, scale: 2, default: '0' })
    balance: string;

    @Column({ type: 'varchar', length: 10, default: 'USD' })
    currency: string;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updatedAt: Date;
}
