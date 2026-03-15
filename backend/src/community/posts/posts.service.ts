import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReputationService } from '../reputation/reputation.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto, SortBy } from './dto/feed-query.dto';
import { Prisma, ReputationAction } from '@prisma/client';

/** Sanitise user-provided text by stripping script tags and event handlers */
function sanitizeText(raw: string): string {
  return raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
}

const USER_SELECT = {
  id: true,
  displayName: true,
  email: true,
  reputationScore: true,
} as const;

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reputationService: ReputationService,
    private readonly uploadsService: UploadsService,
  ) {}

  async createPost(
    userId: string,
    dto: CreatePostDto,
    imageFile?: Express.Multer.File,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    let imageUrl: string | undefined;
    if (imageFile) {
      imageUrl = await this.uploadsService.uploadImage(imageFile);
    }

    let chartSnapshotCreate:
      | Prisma.ChartSnapshotCreateNestedOneWithoutPostInput
      | undefined;
    if (dto.chartState) {
      try {
        const state = JSON.parse(dto.chartState) as {
          symbol: string;
          timeframe: string;
          visibleRangeFrom: number;
          visibleRangeTo: number;
          drawings?: unknown[];
          indicators?: unknown[];
          priceScaleMode?: number;
        };
        chartSnapshotCreate = {
          create: {
            symbol: state.symbol,
            timeframe: state.timeframe,
            visibleRangeFrom: BigInt(Math.floor(state.visibleRangeFrom)),
            visibleRangeTo: BigInt(Math.floor(state.visibleRangeTo)),
            drawings: (state.drawings ?? []) as Prisma.InputJsonValue,
            indicators: (state.indicators ?? []) as Prisma.InputJsonValue,
            priceScaleMode: state.priceScaleMode ?? 0,
          },
        };
      } catch (err) {
        this.logger.warn('Invalid chartState JSON, skipping', err);
      }
    }

    const sanitizedDescription = sanitizeText(dto.description);

    const post = await this.prisma.communityPost.create({
      data: {
        userId,
        type: dto.type,
        symbol: dto.symbol,
        timeframe: dto.timeframe,
        direction: dto.direction,
        entry: dto.entry,
        sl: dto.sl,
        tp: dto.tp,
        description: sanitizedDescription,
        imageUrl,
        chartSnapshot: chartSnapshotCreate,
      },
      include: {
        user: { select: USER_SELECT },
        chartSnapshot: true,
      },
    });

    await this.reputationService.awardPoints(
      userId,
      ReputationAction.POST_CREATED,
      post.id,
    );

    return this.serializePost(post as Record<string, unknown>);
  }

  async getFeed(
    dto: FeedQueryDto,
    currentUserId?: string,
  ): Promise<{
    posts: unknown[];
    total: number;
    page: number;
    hasMore: boolean;
  }> {
    const where: Prisma.CommunityPostWhereInput = { isDeleted: false };
    if (dto.symbol) where.symbol = dto.symbol;
    if (dto.timeframe) where.timeframe = dto.timeframe;
    if (dto.direction) where.direction = dto.direction;
    if (dto.userId) where.userId = dto.userId;

    let orderBy: Prisma.CommunityPostOrderByWithRelationInput;
    switch (dto.sort) {
      case SortBy.MOST_LIKED:
        orderBy = { likesCount: 'desc' };
        break;
      case SortBy.MOST_COMMENTED:
        orderBy = { commentsCount: 'desc' };
        break;
      case SortBy.TRENDING:
        orderBy = { trendingScore: 'desc' };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const skip = (dto.page - 1) * dto.limit;

    const [posts, total] = await this.prisma.$transaction([
      this.prisma.communityPost.findMany({
        where,
        orderBy,
        skip,
        take: dto.limit,
        include: {
          user: { select: USER_SELECT },
          chartSnapshot: true,
          _count: { select: { likes: true, comments: true } },
        },
      }),
      this.prisma.communityPost.count({ where }),
    ]);

    let likedPostIds = new Set<string>();
    let savedPostIds = new Set<string>();
    if (currentUserId) {
      const postIds = posts.map((p) => p.id);
      const [likes, saves] = await Promise.all([
        this.prisma.postLike.findMany({
          where: { userId: currentUserId, postId: { in: postIds } },
          select: { postId: true },
        }),
        this.prisma.savedPost.findMany({
          where: { userId: currentUserId, postId: { in: postIds } },
          select: { postId: true },
        }),
      ]);
      likedPostIds = new Set(likes.map((l) => l.postId));
      savedPostIds = new Set(saves.map((s) => s.postId));
    }

    const serialized = posts.map((p) =>
      this.serializePost(
        p as unknown as Record<string, unknown>,
        likedPostIds.has(p.id),
        savedPostIds.has(p.id),
      ),
    );

    return {
      posts: serialized,
      total,
      page: dto.page,
      hasMore: skip + posts.length < total,
    };
  }

  async getPostById(id: string, currentUserId?: string) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id },
      include: {
        user: { select: USER_SELECT },
        chartSnapshot: true,
        comments: {
          where: { isDeleted: false },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: USER_SELECT } },
        },
        _count: { select: { likes: true, comments: true } },
      },
    });

    if (!post || post.isDeleted) {
      throw new NotFoundException('Post not found');
    }

    let isLiked = false;
    let isSaved = false;
    if (currentUserId) {
      const [like, save] = await Promise.all([
        this.prisma.postLike.findUnique({
          where: { userId_postId: { userId: currentUserId, postId: id } },
        }),
        this.prisma.savedPost.findUnique({
          where: { userId_postId: { userId: currentUserId, postId: id } },
        }),
      ]);
      isLiked = !!like;
      isSaved = !!save;
    }

    return this.serializePost(
      post as unknown as Record<string, unknown>,
      isLiked,
      isSaved,
    );
  }

  async deletePost(userId: string, postId: string): Promise<void> {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException('Post not found');
    if (post.userId !== userId)
      throw new ForbiddenException('You can only delete your own posts');

    await this.prisma.communityPost.update({
      where: { id: postId },
      data: { isDeleted: true },
    });
  }

  async toggleLikePost(
    userId: string,
    postId: string,
  ): Promise<{ liked: boolean; count: number }> {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
    });
    if (!post || post.isDeleted) throw new NotFoundException('Post not found');

    const existing = await this.prisma.postLike.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (existing) {
      await this.prisma.$transaction([
        this.prisma.postLike.delete({
          where: { id: existing.id },
        }),
        this.prisma.communityPost.update({
          where: { id: postId },
          data: { likesCount: { decrement: 1 } },
        }),
      ]);
      await this.updateTrendingScore(postId);
      return { liked: false, count: Math.max(0, post.likesCount - 1) };
    }

    await this.prisma.$transaction([
      this.prisma.postLike.create({ data: { userId, postId } }),
      this.prisma.communityPost.update({
        where: { id: postId },
        data: { likesCount: { increment: 1 } },
      }),
    ]);

    if (post.userId !== userId) {
      await this.reputationService.awardPoints(
        post.userId,
        ReputationAction.POST_LIKED,
        postId,
      );
    }

    await this.updateTrendingScore(postId);
    return { liked: true, count: post.likesCount + 1 };
  }

  async toggleSavePost(
    userId: string,
    postId: string,
  ): Promise<{ saved: boolean }> {
    const existing = await this.prisma.savedPost.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (existing) {
      await this.prisma.savedPost.delete({ where: { id: existing.id } });
      return { saved: false };
    }

    await this.prisma.savedPost.create({ data: { userId, postId } });
    return { saved: true };
  }

  async getTrendingPosts(symbol?: string) {
    const where: Prisma.CommunityPostWhereInput = { isDeleted: false };
    if (symbol) where.symbol = symbol;

    const posts = await this.prisma.communityPost.findMany({
      where,
      orderBy: { trendingScore: 'desc' },
      take: 20,
      include: {
        user: { select: USER_SELECT },
        chartSnapshot: true,
      },
    });

    return posts.map((p) =>
      this.serializePost(p as unknown as Record<string, unknown>),
    );
  }

  async updateTrendingScore(postId: string): Promise<void> {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
      select: { createdAt: true, likesCount: true, commentsCount: true },
    });
    if (!post) return;

    const hoursSinceCreation =
      (Date.now() - post.createdAt.getTime()) / 3_600_000;
    const score =
      (post.likesCount * 3 + post.commentsCount * 2) /
      Math.pow(hoursSinceCreation + 2, 1.8);

    await this.prisma.communityPost.update({
      where: { id: postId },
      data: { trendingScore: score },
    });
  }

  /** Convert Prisma Decimal fields to plain numbers for the API response */
  private serializePost(
    post: Record<string, unknown>,
    isLiked = false,
    isSaved = false,
  ): Record<string, unknown> {
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
      chartSnapshot: snapshot
        ? {
            ...snapshot,
            visibleRangeFrom: Number(snapshot.visibleRangeFrom),
            visibleRangeTo: Number(snapshot.visibleRangeTo),
          }
        : null,
      isLiked,
      isSaved,
      createdAt: (post.createdAt as Date).toISOString(),
      updatedAt: post.updatedAt
        ? (post.updatedAt as Date).toISOString()
        : (post.createdAt as Date).toISOString(),
    };
  }
}
