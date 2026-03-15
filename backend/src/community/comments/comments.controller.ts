import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtGuard } from '../../auth/guard/jwt.guard';

@Controller('api/community/posts/:postId/comments')
@UseGuards(JwtGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  async createComment(
    @Req() req: { user: { id: string } },
    @Param('postId') postId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.createComment(req.user.id, postId, dto);
  }

  @Get()
  async getCommentsByPost(
    @Param('postId') postId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.commentsService.getCommentsByPost(postId, req.user.id);
  }

  @Post('reply/:parentId')
  async replyToComment(
    @Req() req: { user: { id: string } },
    @Param('parentId') parentId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.replyToComment(req.user.id, parentId, dto);
  }

  @Post(':commentId/like')
  async toggleLikeComment(
    @Req() req: { user: { id: string } },
    @Param('commentId') commentId: string,
  ) {
    return this.commentsService.toggleLikeComment(req.user.id, commentId);
  }

  @Delete(':commentId')
  async deleteComment(
    @Req() req: { user: { id: string } },
    @Param('commentId') commentId: string,
  ) {
    await this.commentsService.deleteComment(req.user.id, commentId);
    return { success: true };
  }
}
