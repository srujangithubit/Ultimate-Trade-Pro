import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { BacktestingSession } from './session.entity';

@Entity('backtesting_trades')
export class BacktestingTrade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @ManyToOne(() => BacktestingSession, (session) => session.trades)
  session: BacktestingSession;

  @Column()
  entryDatetime: Date;

  @Column()
  exitDatetime: Date;

  @Column()
  direction: 'long' | 'short';

  @Column('float')
  entryPrice: number;

  @Column('float')
  exitPrice: number;

  @Column('float')
  quantity: number;

  @Column('float', { nullable: true })
  stopLoss: number;

  @Column('float', { nullable: true })
  takeProfit: number;

  @Column('float')
  pnlGross: number;

  @Column('float', { nullable: true })
  pnlNet: number;

  @Column('float', { nullable: true })
  fees: number;

  @CreateDateColumn()
  createdAt: Date;
}
