import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('trading_accounts')
export class TradingAccount {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid')
    userId: string;

    @Column()
    name: string;

    @Column({ nullable: true })
    broker: string;

    @Column({ default: 'live' })
    accountType: string;

    @Column({ default: 'USD' })
    currency: string;

    @Column('float', { default: 0 })
    balance: number;

    @Column('float', { default: 0 })
    equity: number;

    @Column({ nullable: true })
    accountLogin: string;

    @Column({ nullable: true })
    server: string;

    @Column({ nullable: true })
    apiKeyHash: string;

    @Column({ nullable: true })
    lastSeen: Date;

    @Column({ default: true })
    active: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
