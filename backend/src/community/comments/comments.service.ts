import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReputationService } from '../reputation/reputation.service';
import { PostsService } from '../posts/posts.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ReputationAction } from '@prisma/client';

/** Sanitise user-provided text */
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

export interface ThreadedComment {
  id: string;
  postId: string;
  userId: string;
  parentId: string | null;
  content: string;
  likesCount: number;
  isLiked?: boolean;
  createdAt: Date;
  user: {
    id: string;
    displayName: string | null;
    email: string;
    reputationScore: number;
  };
  replies: ThreadedComment[];
}

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reputationService: ReputationService,
    private readonly postsService: PostsService,
  ) {}

  async createComment(userId: string, postId: string, dto: CreateCommentDto) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
    });
    if (!post || post.isDeleted) throw new NotFoundException('Post not found');

    const sanitized = sanitizeText(dto.content);

    const [comment] = await this.prisma.$transaction([
      this.prisma.postComment.create({
        data: {
          postId,
          userId,
          content: sanitized,
          parentId: dto.parentId ?? null,
        },
        include: { user: { select: USER_SELECT } },
      }),
      this.prisma.communityPost.update({
        where: { id: postId },
        data: { commentsCount: { increment: 1 } },
      }),
    ]);

    await this.reputationService.awardPoints(
      userId,
      ReputationAction.COMMENT_CREATED,
      comment.id,
    );
    await this.postsService.updateTrendingScore(postId);

    return {
      ...comment,
      createdAt: comment.createdAt.toISOString(),
    };
  }

  async replyToComment(
    userId: string,
    parentId: string,
    dto: CreateCommentDto,
  ) {
    const parent = await this.prisma.postComment.findUnique({
      where: { id: parentId },
    });
    if (!parent || parent.isDeleted)
      throw new NotFoundException('Parent comment not found');

    return this.createComment(userId, parent.postId, {
      content: dto.content,
      parentId,
    });
  }

  async toggleLikeComment(
    userId: string,
    commentId: string,
  ): Promise<{ liked: boolean; count: number }> {
    const comment = await this.prisma.postComment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.isDeleted)
      throw new NotFoundException('Comment not found');

    const existing = await this.prisma.commentLike.findUnique({
      where: { userId_commentId: { userId, commentId } },
    });

    if (existing) {
      await this.prisma.$transaction([
        this.prisma.commentLike.delete({ where: { id: existing.id } }),
        this.prisma.postComment.update({
          where: { id: commentId },
          data: { likesCount: { decrement: 1 } },
        }),
      ]);
      return { liked: false, count: Math.max(0, comment.likesCount - 1) };
    }

    await this.prisma.$transaction([
      this.prisma.commentLike.create({ data: { userId, commentId } }),
      this.prisma.postComment.update({
        where: { id: commentId },
        data: { likesCount: { increment: 1 } },
      }),
    ]);
    return { liked: true, count: comment.likesCount + 1 };
  }

  async getCommentsByPost(
    postId: string,
    currentUserId?: string,
  ): Promise<ThreadedComment[]> {
    const comments = await this.prisma.postComment.findMany({
      where: { postId, isDeleted: false },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: USER_SELECT } },
    });

    let likedIds = new Set<string>();
    if (currentUserId) {
      const likes = await this.prisma.commentLike.findMany({
        where: {
          userId: currentUserId,
          commentId: { in: comments.map((c) => c.id) },
        },
        select: { commentId: true },
      });
      likedIds = new Set(likes.map((l) => l.commentId));
    }

    const map = new Map<string, ThreadedComment>();
    const roots: ThreadedComment[] = [];

    for (const c of comments) {
      const node: ThreadedComment = {
        id: c.id,
        postId: c.postId,
        userId: c.userId,
        parentId: c.parentId,
        content: c.content,
        likesCount: c.likesCount,
        isLiked: likedIds.has(c.id),
        createdAt: c.createdAt,
        user: c.user,
        replies: [],
      };
      map.set(c.id, node);
    }

    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.replies.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async deleteComment(userId: string, commentId: string): Promise<void> {
    const comment = await this.prisma.postComment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId)
      throw new ForbiddenException('You can only delete your own comments');

    await this.prisma.$transaction([
      this.prisma.postComment.update({
        where: { id: commentId },
        data: { isDeleted: true },
      }),
      this.prisma.communityPost.update({
        where: { id: comment.postId },
        data: { commentsCount: { decrement: 1 } },
      }),
    ]);
  }
}
