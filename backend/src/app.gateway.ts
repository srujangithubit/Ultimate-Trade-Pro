import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { getCorsOrigins } from './common/cors.util';

@WebSocketGateway({
  cors: {
    origin: getCorsOrigins(),
    credentials: true,
  },
})
@Injectable()
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AppGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:backtest')
  handleSubscribeBacktest(
    client: Socket,
    payload: { sessionId: string; userId: string },
  ) {
    this.logger.log(
      `Client ${client.id} subscribed to backtest ${payload.sessionId}`,
    );
    client.join(`backtest:${payload.sessionId}`);

    // Optionally acknowledge the subscription
    client.emit('backtest:subscribed', { sessionId: payload.sessionId });
  }

  @SubscribeMessage('unsubscribe:backtest')
  handleUnsubscribeBacktest(client: Socket, payload: { sessionId: string }) {
    this.logger.log(
      `Client ${client.id} unsubscribed from backtest ${payload.sessionId}`,
    );
    client.leave(`backtest:${payload.sessionId}`);
  }

  // Helper method to emit updates from other services to connected clients
  emitBacktestUpdate(sessionId: string, payload: any) {
    this.server.to(`backtest:${sessionId}`).emit('backtest:update', payload);
  }

  emitTradeEvent(sessionId: string, eventName: string, payload: any) {
    this.server
      .to(`backtest:${sessionId}`)
      .emit(`backtest:${eventName}`, payload);
  }
}
