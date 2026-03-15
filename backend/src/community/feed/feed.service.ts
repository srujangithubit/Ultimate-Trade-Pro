import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Direction, Prisma } from '@prisma/client';

const USER_SELECT = {
  id: true,
  displayName: true,
  email: true,
  reputationScore: true,
} as const;

const POST_INCLUDE = {
  user: { select: USER_SELECT },
  chartSnapshot: true,
  _count: { select: { comments: true } },
} as const;

function serializePost(post: Record<string, unknown>): Record<string, unknown> {
  const snapshot = post.chartSnapshot as Record<string, unknown> | null;
  return {
    ...post,
    entry: post.entry
      ? parseFloat((post.entry as { toString(): string }).toString())
      : null,
    sl: post.sl
      ? parseFloat((post.sl as { toString(): string }).toString())
      : null,
    tp: post.tp
      ? parseFloat((post.tp as { toString(): string }).toString())
      : null,
    createdAt:
      post.createdAt instanceof Date
        ? post.createdAt.toISOString()
        : post.createdAt,
    updatedAt:
      post.updatedAt instanceof Date
        ? post.updatedAt.toISOString()
        : post.updatedAt,
    chartSnapshot: snapshot
      ? {
          ...snapshot,
          visibleRangeFrom: snapshot.visibleRangeFrom
            ? Number(snapshot.visibleRangeFrom)
            : null,
          visibleRangeTo: snapshot.visibleRangeTo
            ? Number(snapshot.visibleRangeTo)
            : null,
          createdAt:
            snapshot.createdAt instanceof Date
              ? snapshot.createdAt.toISOString()
              : snapshot.createdAt,
        }
      : null,
  };
}

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Personalized feed: posts from followed users + trending (fallback)
   */
  async getPersonalizedFeed(userId: string, page = 1, limit = 20) {
    const take = Math.min(limit, 50);
    const skip = (page - 1) * take;

    // Get followed user IDs
    const follows = await this.prisma.userFollow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = follows.map((f) => f.followingId);

    let where: Prisma.CommunityPostWhereInput = { isDeleted: false };

    if (followingIds.length > 0) {
      // Mix: followed users' recent posts + high-trending posts
      where = {
        isDeleted: false,
        OR: [{ userId: { in: followingIds } }, { trendingScore: { gte: 1.0 } }],
      };
    }

    const posts = await this.prisma.communityPost.findMany({
      where,
      orderBy:
        followingIds.length > 0
          ? [{ trendingScore: 'desc' }, { createdAt: 'desc' }]
          : [{ trendingScore: 'desc' }],
      skip,
      take,
      include: POST_INCLUDE,
    });

    // Resolve isLiked / isSaved for current user
    const postIds = posts.map((p) => p.id);
    const [likes, saves] = await Promise.all([
      this.prisma.postLike.findMany({
        where: { userId, postId: { in: postIds } },
        select: { postId: true },
      }),
      this.prisma.savedPost.findMany({
        where: { userId, postId: { in: postIds } },
        select: { postId: true },
      }),
    ]);

    const likedIds = new Set(likes.map((l) => l.postId));
    const savedIds = new Set(saves.map((s) => s.postId));

    return posts.map((p) => ({
      ...serializePost(p),
      isLiked: likedIds.has(p.id),
      isSaved: savedIds.has(p.id),
    }));
  }

  /**
   * Feed filtered by symbol (e.g., trade ideas for EURUSD)
   */
  async getSymbolFeed(symbol: string, userId?: string, page = 1, limit = 20) {
    const take = Math.min(limit, 50);
    const skip = (page - 1) * take;

    const posts = await this.prisma.communityPost.findMany({
      where: { symbol: symbol.toUpperCase(), isDeleted: false },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: POST_INCLUDE,
    });

    if (!userId) return posts.map(serializePost);

    const postIds = posts.map((p) => p.id);
    const [likes, saves] = await Promise.all([
      this.prisma.postLike.findMany({
        where: { userId, postId: { in: postIds } },
        select: { postId: true },
      }),
      this.prisma.savedPost.findMany({
        where: { userId, postId: { in: postIds } },
        select: { postId: true },
      }),
    ]);
    const likedIds = new Set(likes.map((l) => l.postId));
    const savedIds = new Set(saves.map((s) => s.postId));

    return posts.map((p) => ({
      ...serializePost(p),
      isLiked: likedIds.has(p.id),
      isSaved: savedIds.has(p.id),
    }));
  }

  /**
   * Explore feed: trending + diverse content for discovery
   */
  async getExploreFeed(
    userId?: string,
    direction?: Direction,
    page = 1,
    limit = 20,
  ) {
    const take = Math.min(limit, 50);
    const skip = (page - 1) * take;

    const where: Prisma.CommunityPostWhereInput = {
      isDeleted: false,
      ...(direction && { direction }),
    };

    const posts = await this.prisma.communityPost.findMany({
      where,
      orderBy: [{ trendingScore: 'desc' }, { likesCount: 'desc' }],
      skip,
      take,
      include: POST_INCLUDE,
    });

    if (!userId) return posts.map(serializePost);

    const postIds = posts.map((p) => p.id);
    const [likes, saves] = await Promise.all([
      this.prisma.postLike.findMany({
        where: { userId, postId: { in: postIds } },
        select: { postId: true },
      }),
      this.prisma.savedPost.findMany({
        where: { userId, postId: { in: postIds } },
        select: { postId: true },
      }),
    ]);
    const likedIds = new Set(likes.map((l) => l.postId));
    const savedIds = new Set(saves.map((s) => s.postId));

    return posts.map((p) => ({
      ...serializePost(p),
      isLiked: likedIds.has(p.id),
      isSaved: savedIds.has(p.id),
    }));
  }
}
