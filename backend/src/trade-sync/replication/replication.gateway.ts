import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, Inject, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { ReplicationService } from './replication.service';
import { MasterService } from '../master/master.service';
import { SlaveService } from '../slave/slave.service';
import { REDIS_SUBSCRIBER } from '../redis.provider';
import { TRADE_SYNC_EVENTS } from '../trade-sync.events';
import type { MasterTradeEvent } from './replication.engine';
import type Redis from 'ioredis';
import { getCorsOrigins } from '../../common/cors.util';

const WS_EVENT_TTL_MS = 60_000;
const WS_EVENT_LIMIT = (() => {
  const configured = Number(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE ?? '100');
  if (!Number.isFinite(configured) || configured <= 0) {
    return 100;
  }
  return configured;
})();

@WebSocketGateway({
  namespace: '/trade-sync',
  cors: { origin: getCorsOrigins(), credentials: true },
})
export class ReplicationGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ReplicationGateway.name);
  private readonly jwtSecret: string;

  /** Maps socket.id → userId */
  private readonly connectedUsers = new Map<string, string>();
  /** Maps userId → Set<syncGroupId> they are watching */
  private readonly userSubscriptions = new Map<string, Set<string>>();
  /** Maps userId:event -> timestamps for sliding-window limits */
  private readonly eventRateLimit = new Map<string, number[]>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly replicationService: ReplicationService,
    private readonly masterService: MasterService,
    private readonly slaveService: SlaveService,
    @Inject(REDIS_SUBSCRIBER) private readonly redisSub: Redis,
  ) {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is required for trade-sync websocket auth');
    }
    this.jwtSecret = secret;
  }

  afterInit() {
    this.logger.log('Trade Sync WebSocket gateway initialized');
    this.setupRedisSubscriptions();
  }

  handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect();
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const payload = this.jwtService.verify(token, {
        secret: this.jwtSecret,
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const userId: string | undefined = payload.sub ?? payload.id;
      if (!userId) {
        client.disconnect();
        return;
      }

      (client as unknown as { userId: string }).userId = userId;
      this.connectedUsers.set(client.id, userId);
      this.logger.debug(`Trade Sync client connected: ${userId}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.connectedUsers.get(client.id);
    this.connectedUsers.delete(client.id);

    if (userId) {
      this.userSubscriptions.delete(userId);
      this.logger.debug(`Trade Sync client disconnected: ${userId}`);
    }
  }

  onModuleDestroy() {
    this.redisSub.disconnect();
  }

  /* ───── Client-initiated events ───── */

  @SubscribeMessage(TRADE_SYNC_EVENTS.SUBSCRIBE_GROUP)
  handleSubscribeGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { syncGroupId: string },
  ): Promise<void> {
    const userId = this.connectedUsers.get(client.id);
    if (!userId) {
      client.emit('sync:error', { message: 'Unauthorized' });
      return Promise.resolve();
    }
    if (!this.allowWsEvent(client, userId, TRADE_SYNC_EVENTS.SUBSCRIBE_GROUP)) {
      return Promise.resolve();
    }

    return this.masterService
      .getSyncGroupById(data.syncGroupId, userId)
      .then(() => {
        let subs = this.userSubscriptions.get(userId);
        if (!subs) {
          subs = new Set();
          this.userSubscriptions.set(userId, subs);
        }

        subs.add(data.syncGroupId);
        void client.join(`sync:${data.syncGroupId}`);

        this.logger.debug(
          `User ${userId} subscribed to sync group ${data.syncGroupId}`,
        );
      })
      .catch(() => {
        client.emit('sync:error', { message: 'Forbidden' });
      });
  }

  @SubscribeMessage(TRADE_SYNC_EVENTS.UNSUBSCRIBE_GROUP)
  handleUnsubscribeGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { syncGroupId: string },
  ): Promise<void> {
    const userId = this.connectedUsers.get(client.id);
    if (!userId) {
      client.emit('sync:error', { message: 'Unauthorized' });
      return Promise.resolve();
    }
    if (!this.allowWsEvent(client, userId, TRADE_SYNC_EVENTS.UNSUBSCRIBE_GROUP)) {
      return Promise.resolve();
    }

    return this.masterService
      .getSyncGroupById(data.syncGroupId, userId)
      .then(() => {
        const subs = this.userSubscriptions.get(userId);
        if (subs) subs.delete(data.syncGroupId);

        void client.leave(`sync:${data.syncGroupId}`);
      })
      .catch(() => {
        client.emit('sync:error', { message: 'Forbidden' });
      });
  }

  @SubscribeMessage(TRADE_SYNC_EVENTS.MASTER_TRADE)
  async handleMasterTrade(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: MasterTradeEvent,
  ) {
    const userId = this.connectedUsers.get(client.id);
    if (!userId) {
      client.emit('sync:error', { message: 'Unauthorized' });
      return;
    }
    if (!this.allowWsEvent(client, userId, TRADE_SYNC_EVENTS.MASTER_TRADE)) {
      return;
    }

    this.logger.debug(
      `Master trade event: ${data.eventType} ${data.symbol} from ${data.masterId}`,
    );

    let results;
    try {
      results = await this.replicationService.replicateTradeForUser(userId, data);
    } catch {
      client.emit('sync:error', { message: 'Forbidden' });
      return;
    }

    // Emit results back to the room
    this.server
      .to(`sync:${data.syncGroupId}`)
      .emit(TRADE_SYNC_EVENTS.REPLICATION_RESULT, {
        masterTicket: data.ticket,
        symbol: data.symbol,
        direction: data.direction,
        lot: data.lot,
        results,
      });
  }

  @SubscribeMessage(TRADE_SYNC_EVENTS.EXECUTION_CONFIRM)
  async handleExecutionConfirm(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      replicationEventId: string;
      success: boolean;
      slaveTicket?: string;
      errorMessage?: string;
    },
  ) {
    const userId = this.connectedUsers.get(client.id);
    if (!userId) {
      client.emit('sync:error', { message: 'Unauthorized' });
      return;
    }
    if (!this.allowWsEvent(client, userId, TRADE_SYNC_EVENTS.EXECUTION_CONFIRM)) {
      return;
    }

    try {
      await this.replicationService.confirmExecutionForUser(
        userId,
        data.replicationEventId,
        data.success,
        {
          slaveTicket: data.slaveTicket,
          errorMessage: data.errorMessage,
        },
      );
    } catch {
      client.emit('sync:error', { message: 'Forbidden' });
    }
  }

  @SubscribeMessage(TRADE_SYNC_EVENTS.MASTER_HEARTBEAT)
  async handleMasterHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      accountId: string;
      equity: number;
      balance: number;
      floatingPnL: number;
      accountNumber: string;
    },
  ) {
    const userId = this.connectedUsers.get(client.id);
    if (!userId) {
      client.emit('sync:error', { message: 'Unauthorized' });
      return;
    }
    if (!this.allowWsEvent(client, userId, TRADE_SYNC_EVENTS.MASTER_HEARTBEAT)) {
      return;
    }

    try {
      await this.masterService.getOwnedMasterAccount(data.accountId, userId);
    } catch {
      client.emit('sync:error', { message: 'Forbidden' });
      return;
    }

    await this.masterService.updateMasterHeartbeat(data.accountId, data);
  }

  @SubscribeMessage(TRADE_SYNC_EVENTS.SLAVE_HEARTBEAT)
  async handleSlaveHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      slaveId: string;
      equity: number;
      balance: number;
      floatingPnL: number;
      accountNumber: string;
    },
  ) {
    const userId = this.connectedUsers.get(client.id);
    if (!userId) {
      client.emit('sync:error', { message: 'Unauthorized' });
      return;
    }
    if (!this.allowWsEvent(client, userId, TRADE_SYNC_EVENTS.SLAVE_HEARTBEAT)) {
      return;
    }

    try {
      await this.slaveService.getOwnedSlaveAccount(data.slaveId, userId);
    } catch {
      client.emit('sync:error', { message: 'Forbidden' });
      return;
    }

    await this.slaveService.updateSlaveHeartbeat(data.slaveId, data);
  }

  @SubscribeMessage(TRADE_SYNC_EVENTS.PING)
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit(TRADE_SYNC_EVENTS.PONG, { ts: Date.now() });
  }

  /* ───── Redis subscription → Socket.IO broadcast ───── */

  private setupRedisSubscriptions() {
    void this.redisSub.psubscribe('trade-sync:group:*', (err) => {
      if (err) {
        this.logger.error('Redis psubscribe failed', err);
      } else {
        this.logger.log('Subscribed to trade-sync:group:* channels');
      }
    });

    this.redisSub.on('pmessage', (_pattern, channel, message) => {
      const match = channel.match(/trade-sync:group:(.+)/);
      if (!match) return;

      const syncGroupId = match[1];
      try {
        const parsed = JSON.parse(message) as Record<string, unknown>;
        this.server
          .to(`sync:${syncGroupId}`)
          .emit((parsed.type as string) ?? 'sync:update', parsed);
      } catch {
        this.logger.warn('Failed to parse Redis message');
      }
    });
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken;
    }

    const authHeader = client.handshake.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim() || null;
    }

    return null;
  }

  private allowWsEvent(client: Socket, userId: string, eventName: string): boolean {
    const key = `${userId}:${eventName}`;
    const now = Date.now();
    const windowStart = now - WS_EVENT_TTL_MS;
    const recent = (this.eventRateLimit.get(key) ?? []).filter(
      (ts) => ts > windowStart,
    );

    if (recent.length >= WS_EVENT_LIMIT) {
      client.emit('sync:error', { message: 'Rate limit exceeded' });
      return false;
    }

    recent.push(now);
    this.eventRateLimit.set(key, recent);
    return true;
  }
}
