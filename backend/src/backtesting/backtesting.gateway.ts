import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BacktestingService } from './backtesting.service';
import { ReplaySpeed } from './types/replay.types';
import { getCorsOrigins } from '../common/cors.util';
import { ObservabilityService } from '../observability/observability.service';

const WS_EVENT_TTL_MS = 60_000;
const WS_EVENT_LIMIT = (() => {
    const configured = Number(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE ?? '100');
    if (!Number.isFinite(configured) || configured <= 0) {
        return 100;
    }
    return configured;
})();

@WebSocketGateway({
    cors: {
        origin: getCorsOrigins(),
        credentials: true,
    },
    transports: ['websocket', 'polling'],
})
@Injectable()
export class BacktestingGateway
    implements OnGatewayConnection, OnGatewayDisconnect
{
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(BacktestingGateway.name);
    /** Track which sessionId each socket is subscribed to */
    private readonly clientSessions = new Map<string, string>();
    /** Maps socket.id -> authenticated userId */
    private readonly connectedUsers = new Map<string, string>();
    /** Maps userId:event -> timestamps for simple sliding-window rate limits */
    private readonly eventRateLimit = new Map<string, number[]>();

    constructor(
        private readonly backtestingService: BacktestingService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly observability: ObservabilityService,
    ) {}

    handleConnection(client: Socket) {
        const token = this.extractToken(client);
        const secret = this.configService.get<string>('JWT_SECRET');

        if (!token || !secret) {
            this.observability.markApiError('ws', 'unauthorized_connect');
            client.emit('backtest:error', { message: 'Unauthorized', type: 'auth_error' });
            client.disconnect();
            return;
        }

        try {
            const payload = this.jwtService.verify<{ sub?: string; id?: string }>(token, {
                secret,
            });
            const userId = payload.sub ?? payload.id;
            if (!userId) {
                this.observability.markApiError('ws', 'unauthorized_connect');
                client.emit('backtest:error', { message: 'Unauthorized', type: 'auth_error' });
                client.disconnect();
                return;
            }

            this.connectedUsers.set(client.id, userId);
        } catch {
            this.observability.markApiError('ws', 'unauthorized_connect');
            client.emit('backtest:error', { message: 'Unauthorized', type: 'auth_error' });
            client.disconnect();
        }
    }

    /** When a client disconnects, pause the engine if the room is now empty. */
    async handleDisconnect(client: Socket) {
        this.connectedUsers.delete(client.id);
        const sessionId = this.clientSessions.get(client.id);
        this.clientSessions.delete(client.id);
        if (!sessionId) return;

        const room = `backtest:${sessionId}`;
        const roomClients = this.server.sockets.adapter.rooms.get(room);
        const remaining = roomClients ? roomClients.size : 0;
        if (remaining === 0) {
            this.logger.log(`Room ${room} is empty after disconnect — pausing engine`);
            await this.backtestingService.pauseSession(sessionId);
        }
    }

    @SubscribeMessage('backtest:subscribe')
    async handleSubscribe(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { sessionId: string },
    ) {
        const userId = await this.getAuthorizedUserId(client);
        if (!userId) return;
        const hasAccess = await this.ensureSessionAccess(client, userId, payload.sessionId);
        if (!hasAccess) return;

        const room = `backtest:${payload.sessionId}`;
        client.join(room);
        this.clientSessions.set(client.id, payload.sessionId);
        this.logger.log(`Client ${client.id} joined room ${room}`);

        // If the engine is still running from a prior session, pause it so the
        // user can decide when to resume.
        const state = await this.backtestingService.getActiveEngineState(payload.sessionId);
        if (state) {
            if (state.status === 'playing') {
                this.logger.log(`Pausing stale engine for session ${payload.sessionId}`);
                await this.backtestingService.pauseSession(payload.sessionId);
            }
            // Send the (now-paused) state to the client
            const updated = await this.backtestingService.getActiveEngineState(payload.sessionId);
            const syncState = updated ?? state;
            client.emit('backtest:state_sync', { ...syncState, trigger: 'subscribe' });
        }
    }

    @SubscribeMessage('backtest:play')
    async handlePlay(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { sessionId: string; speed?: ReplaySpeed },
    ) {
        const userId = await this.getAuthorizedUserId(client);
        if (!userId) return;
        if (!this.allowWsEvent(client, userId, 'backtest:play')) return;
        const hasAccess = await this.ensureSessionAccess(client, userId, payload.sessionId);
        if (!hasAccess) return;

        this.logger.log(`Play backtest ${payload.sessionId}`);
        try {
            client.join(`backtest:${payload.sessionId}`);
            const speed: ReplaySpeed = payload.speed ?? 1;
            await this.backtestingService.playSession(
                payload.sessionId,
                speed,
                (event: string, data: unknown) => {
                    this.server.to(`backtest:${payload.sessionId}`).emit(event, data);
                },
            );
            // Emit state_sync with trigger:'play' BEFORE starting the engine
            // so clients set isPlaying=true before the first update tick.
            const state = await this.backtestingService.getActiveEngineState(payload.sessionId);
            if (state) {
                this.server.to(`backtest:${payload.sessionId}`).emit('backtest:state_sync', { ...state, trigger: 'play' });
            }
            // Now start ticking — updates will flow after clients see state_sync
            this.backtestingService.startEngine(payload.sessionId);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`handlePlay caught: ${message}`);
            client.emit('backtest:error', { message, type: 'play_error' });
        }
    }

    @SubscribeMessage('backtest:pause')
    async handlePause(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { sessionId: string },
    ) {
        const userId = await this.getAuthorizedUserId(client);
        if (!userId) return;
        if (!this.allowWsEvent(client, userId, 'backtest:pause')) return;
        const hasAccess = await this.ensureSessionAccess(client, userId, payload.sessionId);
        if (!hasAccess) return;

        this.logger.log(`Pause backtest ${payload.sessionId}`);
        await this.backtestingService.pauseSession(payload.sessionId);
        // Confirm pause state to the room
        const state = await this.backtestingService.getActiveEngineState(payload.sessionId);
        if (state) {
            this.server.to(`backtest:${payload.sessionId}`).emit('backtest:state_sync', { ...state, trigger: 'pause' });
        }
    }

    @SubscribeMessage('backtest:seek')
    async handleSeek(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { sessionId: string; index: number },
    ) {
        const userId = await this.getAuthorizedUserId(client);
        if (!userId) return;
        if (!this.allowWsEvent(client, userId, 'backtest:seek')) return;
        const hasAccess = await this.ensureSessionAccess(client, userId, payload.sessionId);
        if (!hasAccess) return;

        this.logger.log(`Seek backtest ${payload.sessionId} to ${payload.index}`);
        try {
            await this.backtestingService.seekSession(payload.sessionId, payload.index);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            client.emit('backtest:error', { message });
        }
    }

    @SubscribeMessage('backtest:speed')
    async handleSpeed(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { sessionId: string; speed: ReplaySpeed },
    ) {
        const userId = await this.getAuthorizedUserId(client);
        if (!userId) return;
        if (!this.allowWsEvent(client, userId, 'backtest:speed')) return;
        const hasAccess = await this.ensureSessionAccess(client, userId, payload.sessionId);
        if (!hasAccess) return;

        this.logger.log(`Speed backtest ${payload.sessionId} to ${payload.speed}`);
        await this.backtestingService.setSessionSpeed(payload.sessionId, payload.speed);
    }

    @SubscribeMessage('backtest:change_timeframe')
    async handleChangeTimeframe(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { sessionId: string; timeframe: string },
    ) {
        const userId = await this.getAuthorizedUserId(client);
        if (!userId) return;
        if (!this.allowWsEvent(client, userId, 'backtest:change_timeframe')) return;
        const hasAccess = await this.ensureSessionAccess(client, userId, payload.sessionId);
        if (!hasAccess) return;

        this.logger.log(`Change timeframe for session ${payload.sessionId} to ${payload.timeframe}`);
        try {
            const result = await this.backtestingService.changeTimeframe(
                payload.sessionId,
                payload.timeframe,
            );
            if (result) {
                // Notify all clients in the room about the timeframe change
                this.server.to(`backtest:${payload.sessionId}`).emit('backtest:state_sync', {
                    timeframeChanged: true,
                    newIndex: result.newIndex,
                    resolution: result.resolution,
                });
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`handleChangeTimeframe caught: ${message}`);
            client.emit('backtest:error', { message, type: 'timeframe_error' });
        }
    }

    @SubscribeMessage('backtest:order')
    async handleOrder(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { sessionId: string; order: { orderType: string; direction: string; quantity: number; price?: number; stopPrice?: number; sl?: number; tp?: number; notes?: string } },
    ) {
        try {
            const userId = await this.getAuthorizedUserId(client);
            if (!userId) return;
            if (!this.allowWsEvent(client, userId, 'backtest:order')) return;
            const trade = await this.backtestingService.executeOrder(userId, payload.sessionId, payload.order as any);
            client.emit('backtest:order_confirmed', { sessionId: payload.sessionId, trade });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            client.emit('backtest:error', { message });
        }
    }

    @SubscribeMessage('backtest:close_trade')
    async handleCloseTrade(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { sessionId: string; tradeId: string; exitPrice?: number },
    ) {
        try {
            const userId = await this.getAuthorizedUserId(client);
            if (!userId) return;
            if (!this.allowWsEvent(client, userId, 'backtest:close_trade')) return;
            const closedTrade = await this.backtestingService.closeTrade(
                userId,
                payload.sessionId,
                payload.tradeId,
                payload.exitPrice ?? 0,
            );
            client.emit('backtest:trade_closed', { sessionId: payload.sessionId, trade: closedTrade });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            client.emit('backtest:error', { message });
        }
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

    private async getAuthorizedUserId(client: Socket): Promise<string | null> {
        const userId = this.connectedUsers.get(client.id);
        if (!userId) {
            client.emit('backtest:error', { message: 'Unauthorized', type: 'auth_error' });
            client.disconnect();
            return null;
        }

        return userId;
    }

    private async ensureSessionAccess(
        client: Socket,
        userId: string,
        sessionId: string,
    ): Promise<boolean> {
        try {
            await this.backtestingService.getSession(userId, sessionId);
            return true;
        } catch {
            client.emit('backtest:error', { message: 'Forbidden', type: 'authorization_error' });
            return false;
        }
    }

    private allowWsEvent(client: Socket, userId: string, eventName: string): boolean {
        const key = `${userId}:${eventName}`;
        const now = Date.now();
        const windowStart = now - WS_EVENT_TTL_MS;
        const recent = (this.eventRateLimit.get(key) ?? []).filter((ts) => ts > windowStart);

        if (recent.length >= WS_EVENT_LIMIT) {
            this.observability.markRateLimitViolation('ws', eventName);
            client.emit('backtest:error', {
                message: 'Rate limit exceeded',
                type: 'rate_limit',
            });
            return false;
        }

        recent.push(now);
        this.eventRateLimit.set(key, recent);
        return true;
    }
}
