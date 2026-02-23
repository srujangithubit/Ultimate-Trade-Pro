import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { BacktestingTrade } from './trade.entity';
import { BacktestingPosition } from './position.entity';

@Entity('backtesting_sessions')
export class BacktestingSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  sessionName: string;

  @Column()
  instrument: string;

  @Column({ nullable: true })
  assetClass: string;

  @Column({ default: '15m' })
  timeframe: string;

  @Column('float', { default: 10000 })
  startingBalance: number;

  @Column('float', { default: 10000 })
  currentBalance: number;

  @Column()
  startDate: Date;

  @Column()
  endDate: Date;

  @Column()
  currentTimestamp: Date;

  @Column({ default: 'active' }) // active, paused, completed
  status: string;

  @Column({ nullable: true })
  playbookId: string;

  @Column('float', { default: 1 })
  playbackSpeed: number;

  @OneToMany(() => BacktestingTrade, (trade) => trade.session)
  trades: BacktestingTrade[];

  @OneToMany(() => BacktestingPosition, (position) => position.session)
  positions: BacktestingPosition[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
