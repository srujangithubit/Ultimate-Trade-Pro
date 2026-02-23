import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BacktestingSession } from './session.entity';

@Entity('backtesting_positions')
export class BacktestingPosition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @ManyToOne(() => BacktestingSession, (session) => session.positions)
  session: BacktestingSession;

  @Column()
  instrument: string;

  @Column()
  direction: 'long' | 'short';

  @Column('float')
  quantity: number;

  @Column('float')
  entryPrice: number;

  @Column('float')
  currentPrice: number;

  @Column('float', { nullable: true })
  stopLoss: number;

  @Column('float', { nullable: true })
  takeProfit: number;

  @Column({ default: 'open' })
  status: 'open' | 'closed';

  @Column()
  openedAt: Date;

  @Column({ nullable: true })
  closedAt: Date;

  @Column('float', { nullable: true })
  unrealizedPnl: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
