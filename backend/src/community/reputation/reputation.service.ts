import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReputationAction } from '@prisma/client';

interface ReputationLevel {
  min: number;
  max: number;
  label: string;
  color: string;
  badge: string;
}

export interface ReputationData {
  score: number;
  level: { label: string; color: string; badge: string };
  history: { action: ReputationAction; points: number; createdAt: Date }[];
}

export interface LeaderboardEntry {
  id: string;
  displayName: string | null;
  email: string;
  reputationScore: number;
  level: { label: string; color: string; badge: string };
}

const REPUTATION_POINTS: Record<ReputationAction, number> = {
  POST_CREATED: 10,
  POST_LIKED: 5,
  COMMENT_CREATED: 2,
  POST_SHARED: 3,
  FOLLOWED: 1,
};

const REPUTATION_LEVELS: ReputationLevel[] = [
  { min: 0, max: 99, label: 'Novice', color: '#64748b', badge: '🔰' },
  { min: 100, max: 499, label: 'Trader', color: '#3b82f6', badge: '📈' },
  { min: 500, max: 1499, label: 'Expert', color: '#8b5cf6', badge: '⚡' },
  { min: 1500, max: 4999, label: 'Pro', color: '#f59e0b', badge: '🏆' },
  { min: 5000, max: Infinity, label: 'Elite', color: '#00ff9f', badge: '💎' },
];

@Injectable()
export class ReputationService {
  private readonly logger = new Logger(ReputationService.name);

  constructor(private readonly prisma: PrismaService) {}

  private getLevelForScore(score: number): ReputationLevel {
    return (
      REPUTATION_LEVELS.find((l) => score >= l.min && score <= l.max) ??
      REPUTATION_LEVELS[0]
    );
  }

  async awardPoints(
    userId: string,
    action: ReputationAction,
    referenceId?: string,
  ): Promise<void> {
    const points = REPUTATION_POINTS[action];
    try {
      await this.prisma.$transaction([
        this.prisma.reputationEvent.create({
          data: { userId, action, points, referenceId },
        }),
        this.prisma.user.update({
          where: { id: userId },
          data: { reputationScore: { increment: points } },
        }),
      ]);
    } catch (err) {
      this.logger.error(
        `Failed to award ${points} reputation to ${userId}`,
        err,
      );
    }
  }

  async getUserReputation(userId: string): Promise<ReputationData> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { reputationScore: true },
    });
    const score = user?.reputationScore ?? 0;
    const level = this.getLevelForScore(score);
    const history = await this.prisma.reputationEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return {
      score,
      level: { label: level.label, color: level.color, badge: level.badge },
      history: history.map((h) => ({
        action: h.action,
        points: h.points,
        createdAt: h.createdAt,
      })),
    };
  }

  async getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { reputationScore: 'desc' },
      take: limit,
      select: {
        id: true,
        displayName: true,
        email: true,
        reputationScore: true,
      },
    });
    return users.map((u) => {
      const level = this.getLevelForScore(u.reputationScore);
      return {
        id: u.id,
        displayName: u.displayName,
        email: u.email,
        reputationScore: u.reputationScore,
        level: { label: level.label, color: level.color, badge: level.badge },
      };
    });
  }
}
