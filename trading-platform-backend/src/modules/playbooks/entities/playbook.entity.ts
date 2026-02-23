import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('playbooks')
export class Playbook {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @Column()
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column('simple-array', { nullable: true })
    rules: string[];

    @Column('simple-array', { nullable: true })
    tags: string[];

    @Column({ type: 'int', default: 0 })
    totalTrades: number;

    @Column({ type: 'float', default: 0 })
    winRate: number;

    @Column({ type: 'float', default: 0 })
    avgRR: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
