import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { COMMUNITY_EVENTS } from '../community.events';
import { getCorsOrigins } from '../../common/cors.util';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  displayName?: string;
}

const RATE_LIMIT_INTERVAL = 500; // ms between messages
const rateLimitMap = new Map<string, number>();

@WebSocketGateway({
  namespace: '/community',
  cors: { origin: getCorsOrigins(), credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private onlineUsers = new Map<string, Set<string>>(); // roomId -> Set<userId>

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  handleConnection(client: AuthenticatedSocket) {
    try {
      const token = String(
        client.handshake.auth?.token ||
          client.handshake.headers?.authorization?.replace('Bearer ', '') ||
          '',
      );
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify<{
        sub: string;
        displayName?: string;
        email?: string;
      }>(token, {
        secret: this.configService.get('JWT_SECRET'),
      });
      client.userId = payload.sub;
      client.displayName = payload.displayName || payload.email;
      this.logger.log(`Client connected: ${client.userId}`);
      this.server.emit(COMMUNITY_EVENTS.USER_ONLINE, {
        userId: client.userId,
        displayName: client.displayName,
      });
    } catch {
      this.logger.warn('Unauthorized WS connection attempt');
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (!client.userId) return;
    this.logger.log(`Client disconnected: ${client.userId}`);

    // Remove from all rooms
    for (const [roomId, users] of this.onlineUsers.entries()) {
      if (users.delete(client.userId)) {
        this.server.to(roomId).emit(COMMUNITY_EVENTS.ROOM_USERS, {
          roomId,
          users: Array.from(users),
        });
      }
    }

    this.server.emit(COMMUNITY_EVENTS.USER_OFFLINE, {
      userId: client.userId,
    });
  }

  @SubscribeMessage(COMMUNITY_EVENTS.JOIN_ROOM)
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!client.userId) return;
    const { roomId } = data;
    void client.join(roomId);

    if (!this.onlineUsers.has(roomId)) {
      this.onlineUsers.set(roomId, new Set());
    }
    this.onlineUsers.get(roomId)!.add(client.userId);

    // Send recent history
    const history = await this.chatService.getMessageHistory(roomId);
    client.emit('message_history', { roomId, messages: history });

    // Broadcast online users
    this.server.to(roomId).emit(COMMUNITY_EVENTS.ROOM_USERS, {
      roomId,
      users: Array.from(this.onlineUsers.get(roomId)!),
    });
  }

  @SubscribeMessage(COMMUNITY_EVENTS.LEAVE_ROOM)
  handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!client.userId) return;
    const { roomId } = data;
    void client.leave(roomId);

    this.onlineUsers.get(roomId)?.delete(client.userId);
    this.server.to(roomId).emit(COMMUNITY_EVENTS.ROOM_USERS, {
      roomId,
      users: Array.from(this.onlineUsers.get(roomId) ?? []),
    });
  }

  @SubscribeMessage(COMMUNITY_EVENTS.SEND_MESSAGE)
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomId: string; content: string; fileUrl?: string },
  ) {
    if (!client.userId) return;

    // Rate limiting
    const now = Date.now();
    const lastSent = rateLimitMap.get(client.userId) ?? 0;
    if (now - lastSent < RATE_LIMIT_INTERVAL) {
      client.emit('error', { message: 'Slow down — rate limited' });
      return;
    }
    rateLimitMap.set(client.userId, now);

    const message = await this.chatService.saveMessage(
      client.userId,
      data.roomId,
      data.content,
      data.fileUrl,
    );

    this.server.to(data.roomId).emit(COMMUNITY_EVENTS.NEW_MESSAGE, message);
  }

  @SubscribeMessage(COMMUNITY_EVENTS.ADD_REACTION)
  async handleAddReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string; emoji: string },
  ) {
    if (!client.userId) return;
    const reactions = await this.chatService.addReaction(
      client.userId,
      data.messageId,
      data.emoji,
    );
    this.server.emit(COMMUNITY_EVENTS.MESSAGE_REACTION, {
      messageId: data.messageId,
      reactions,
    });
  }

  @SubscribeMessage(COMMUNITY_EVENTS.TYPING)
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!client.userId) return;
    client.to(data.roomId).emit(COMMUNITY_EVENTS.USER_TYPING, {
      userId: client.userId,
      displayName: client.displayName,
    });
  }
}
