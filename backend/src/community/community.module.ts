import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PostsService } from './posts/posts.service';
import { PostsController } from './posts/posts.controller';
import { CommentsService } from './comments/comments.service';
import { CommentsController } from './comments/comments.controller';
import { ChatGateway } from './chat/chat.gateway';
import { ChatService } from './chat/chat.service';
import { ChatController } from './chat/chat.controller';
import { ReputationService } from './reputation/reputation.service';
import { ReputationController } from './reputation/reputation.controller';
import { UploadsService } from './uploads/uploads.service';
import { FeedService } from './feed/feed.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [
    PostsController,
    CommentsController,
    ChatController,
    ReputationController,
  ],
  providers: [
    PostsService,
    CommentsService,
    ChatGateway,
    ChatService,
    ReputationService,
    UploadsService,
    FeedService,
  ],
  exports: [PostsService, FeedService],
})
export class CommunityModule {}
