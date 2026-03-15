import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('trades')
export class Trade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column('uuid', { nullable: true })
  accountId: string;

  @Column()
  instrument: string;

  @Column({ nullable: true })
  assetClass: string;

  @Column({ nullable: true })
  setup: string; // Added setup field

  @Column()
  entryDatetime: Date;

  @Column({ nullable: true })
  exitDatetime: Date;

  @Column()
  direction: 'long' | 'short';

  @Column('float')
  entryPrice: number;

  @Column('float', { nullable: true })
  exitPrice: number;

  @Column('float')
  quantity: number;

  @Column('float', { nullable: true })
  stopLoss: number;

  @Column('float', { nullable: true })
  takeProfit: number;

  @Column('float', { default: 0 })
  pnlGross: number;

  @Column('float', { default: 0 })
  pnlNet: number;

  @Column('float', { default: 0 })
  fees: number;

  @Column('float', { default: 0 })
  commission: number;

  @Column('jsonb', { nullable: true })
  tags: string[];

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column('float', { nullable: true })
  riskRewardRatio: number;

  @Column('float', { nullable: true })
  tradeDurationMinutes: number;

  @Column({ default: 'manual' }) // manual, imported
  source: string;

  @Column('jsonb', { nullable: true })
  screenshots: string[]; // URLs

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
