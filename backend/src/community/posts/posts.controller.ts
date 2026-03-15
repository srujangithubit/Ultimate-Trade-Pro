import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { JwtGuard } from '../../auth/guard/jwt.guard';

const multerConfig = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException('Only jpg/png/webp allowed'), false);
    }
  },
};

@Controller('api/community/posts')
@UseGuards(JwtGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image', multerConfig))
  async createPost(
    @Req() req: { user: { id: string } },
    @Body() dto: CreatePostDto,
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<Record<string, unknown>> {
    return this.postsService.createPost(req.user.id, dto, image);
  }

  @Get()
  async getFeed(
    @Query() dto: FeedQueryDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.postsService.getFeed(dto, req.user.id);
  }

  @Get('trending')
  async getTrendingPosts(@Query('symbol') symbol?: string) {
    return this.postsService.getTrendingPosts(symbol);
  }

  @Get(':id')
  async getPostById(
    @Param('id') id: string,
    @Req() req: { user: { id: string } },
  ): Promise<Record<string, unknown>> {
    return this.postsService.getPostById(id, req.user.id);
  }

  @Delete(':id')
  async deletePost(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    await this.postsService.deletePost(req.user.id, id);
    return { success: true };
  }

  @Post(':id/like')
  async toggleLikePost(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.postsService.toggleLikePost(req.user.id, id);
  }

  @Post(':id/save')
  async toggleSavePost(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.postsService.toggleSavePost(req.user.id, id);
  }

  @Get('user/:userId')
  async getPostsByUser(
    @Param('userId') userId: string,
    @Query() dto: FeedQueryDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.postsService.getFeed({ ...dto, userId }, req.user.id);
  }
}
