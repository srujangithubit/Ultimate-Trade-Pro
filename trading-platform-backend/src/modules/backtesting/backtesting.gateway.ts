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
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Using JwtAuthGuard for now, distinct WsJwtGuard might be needed for WS

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class BacktestingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, Socket>();

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);

    // Remove from user sockets map - simplified logic
    // In real app, map store userId -> socketId[]
    for (const [userId, socket] of this.userSockets.entries()) {
      if (socket.id === client.id) {
        this.userSockets.delete(userId);
        break;
      }
    }
  }

  // @UseGuards(JwtAuthGuard) // WS Auth needs specific handling (token in query or handshake)
  @SubscribeMessage('subscribe:backtest')
  handleSubscribeBacktest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; userId: string },
  ) {
    // Store user socket for targeted emissions
    this.userSockets.set(data.userId, client);

    // Join room for this session
    client.join(`session:${data.sessionId}`);

    return { status: 'subscribed', sessionId: data.sessionId };
  }

  @SubscribeMessage('unsubscribe:backtest')
  handleUnsubscribeBacktest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    client.leave(`session:${data.sessionId}`);
    return { status: 'unsubscribed', sessionId: data.sessionId };
  }

  // Emit to specific user
  emitToUser(userId: string, event: string, data: any) {
    const socket = this.userSockets.get(userId);
    if (socket) {
      socket.emit(event, data);
    }
  }

  // Emit to session room
  emitToSession(sessionId: string, event: string, data: any) {
    this.server.to(`session:${sessionId}`).emit(event, data);
  }

  // Specific event emitters
  emitPlaybackUpdate(userId: string, sessionId: string, data: any) {
    this.emitToUser(userId, 'backtest:update', {
      sessionId,
      ...data,
    });
  }

  emitPositionOpened(userId: string, sessionId: string, position: any) {
    this.emitToUser(userId, 'backtest:position-opened', {
      sessionId,
      position,
    });
  }

  emitTradeCompleted(userId: string, sessionId: string, trade: any) {
    this.emitToUser(userId, 'backtest:trade-completed', {
      sessionId,
      trade,
    });
  }
}
