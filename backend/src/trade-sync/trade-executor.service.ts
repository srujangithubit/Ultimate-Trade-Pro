import {
  Injectable,
  Logger,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ReplicationEngine } from './replication/replication.engine';
import { REDIS_CLIENT } from './redis.provider';
import type Redis from 'ioredis';

/**
 * Execution payload published by ReplicationEngine to
 * `trade-sync:execute:{slaveId}`.
 */
interface ExecutionPayload {
  replicationEventId: string;
  slaveId: string;
  slaveAccountNumber: string;
  slaveBroker: string;
  slaveServer: string;
  symbol: string;
  direction: string;
  lot: number;
  stopLoss?: number;
  takeProfit?: number;
  price: number;
  masterTicket: string;
  eventType: string;
  slippagePoints: number;
}

/**
 * Trade Executor – subscribes to `trade-sync:execute:*` Redis channels
 * and executes the trades on slave MT5 accounts via the MT5 Node REST API.
 *
 * Flow:
 *   ReplicationEngine → Redis pub `trade-sync:execute:{slaveId}`
 *    → TradeExecutorService (this) subscribes
 *    → calls POST /api/mt5/order on the MT5 Node server
 *    → confirms execution back to ReplicationEngine
 */
@Injectable()
export class TradeExecutorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TradeExecutorService.name);
  private readonly mt5BaseUrl: string;
  private readonly mt5InternalApiKey: string;
  private subscriber: Redis | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly replicationEngine: ReplicationEngine,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.mt5BaseUrl =
      this.configService.get<string>('MT5_SERVER_URL') ||
      'http://localhost:3001';
    this.mt5InternalApiKey =
      this.configService.get<string>('MT5_INTERNAL_API_KEY') || '';
  }

  async onModuleInit() {
    // Create a dedicated Redis subscriber (duplicate of the injected client)
    this.subscriber = this.redis.duplicate();

    await this.subscriber.psubscribe('trade-sync:execute:*');
    this.logger.log('Subscribed to trade-sync:execute:* channels');

    this.subscriber.on('pmessage', (_pattern, channel, message) => {
      void this.handleExecution(channel, message);
    });
  }

  onModuleDestroy() {
    if (this.subscriber) {
      void this.subscriber.punsubscribe('trade-sync:execute:*');
      this.subscriber.disconnect();
      this.subscriber = null;
    }
  }

  /* ──────────────────── Execution Handler ──────────────────── */

  private async handleExecution(
    channel: string,
    message: string,
  ): Promise<void> {
    let payload: ExecutionPayload;
    try {
      payload = JSON.parse(message) as ExecutionPayload;
    } catch {
      this.logger.warn(`Invalid execution payload on ${channel}`);
      return;
    }

    this.logger.log(
      `⚡ Executing ${payload.eventType} ${payload.direction} ${payload.symbol} ` +
        `${payload.lot} lots on slave ${payload.slaveAccountNumber} ` +
        `(event: ${payload.replicationEventId})`,
    );

    try {
      if (
        payload.eventType === 'TRADE_OPEN' ||
        payload.eventType === 'TRADE_MODIFY'
      ) {
        await this.executeOpen(payload);
      } else if (payload.eventType === 'TRADE_CLOSE') {
        await this.executeClose(payload);
      } else if (
        payload.eventType === 'SL_MODIFY' ||
        payload.eventType === 'TP_MODIFY'
      ) {
        await this.executeModify(payload);
      } else {
        this.logger.warn(`Unknown eventType: ${payload.eventType}`);
        await this.replicationEngine.confirmExecution(
          payload.replicationEventId,
          false,
          { errorMessage: `Unknown eventType: ${payload.eventType}` },
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Execution failed: ${msg}`);
      await this.replicationEngine.confirmExecution(
        payload.replicationEventId,
        false,
        { errorMessage: msg },
      );
    }
  }

  /* ──────────────────── Open / Close / Modify ──────────────────── */

  private async executeOpen(payload: ExecutionPayload): Promise<void> {
    // Look up slave MT5 credentials from environment or DB
    const creds = await this.getSlaveCredentials(payload.slaveId, payload.slaveAccountNumber);

    const body: Record<string, unknown> = {
      symbol: payload.symbol,
      direction: payload.direction,
      volume: payload.lot,
      sl: payload.stopLoss || 0,
      tp: payload.takeProfit || 0,
      slippage: payload.slippagePoints,
      magic: 123456,
      comment: `TP_Sync:${payload.masterTicket}`,
    };

    // If slave is on a different account, include credentials so MT5
    // temporarily switches to that account
    if (creds) {
      body.login = creds.login;
      body.password = creds.password;
      body.server = creds.server;
    }

    const result = await this.callMt5Api('POST', '/api/mt5/order', body);

    if (result?.success && result.data) {
      this.logger.log(
        `✅ Trade placed on slave ${payload.slaveAccountNumber}: ` +
          `ticket ${result.data.order}, price ${result.data.price}`,
      );
      await this.replicationEngine.confirmExecution(
        payload.replicationEventId,
        true,
        { slaveTicket: String(result.data.order) },
      );
    } else {
      const errMsg = String(
        result?.data?.comment || result?.error || 'Unknown order error',
      );
      this.logger.warn(
        `❌ Trade rejected on slave ${payload.slaveAccountNumber}: ${errMsg}`,
      );
      await this.replicationEngine.confirmExecution(
        payload.replicationEventId,
        false,
        { errorMessage: errMsg },
      );
    }
  }

  private async executeClose(payload: ExecutionPayload): Promise<void> {
    // Find the slave ticket that corresponds to this master ticket
    const repEvent = await this.prisma.replicationEvent.findFirst({
      where: {
        masterTicket: payload.masterTicket,
        slaveId: payload.slaveId,
        status: 'SUCCESS',
      },
      orderBy: { initiatedAt: 'desc' },
      select: { slaveTicket: true },
    });

    if (!repEvent?.slaveTicket) {
      this.logger.warn(
        `No matching slave ticket found for master ticket ${payload.masterTicket} — cannot close`,
      );
      await this.replicationEngine.confirmExecution(
        payload.replicationEventId,
        false,
        { errorMessage: 'No matching slave ticket for close' },
      );
      return;
    }

    const creds = await this.getSlaveCredentials(payload.slaveId, payload.slaveAccountNumber);

    let url = `/api/mt5/order/${repEvent.slaveTicket}?slippage=${payload.slippagePoints}`;
    if (creds) {
      url += `&login=${creds.login}&password=${encodeURIComponent(creds.password)}&server=${encodeURIComponent(creds.server)}`;
    }

    const result = await this.callMt5Api('DELETE', url);

    if (result?.success) {
      this.logger.log(
        `✅ Position ${repEvent.slaveTicket} closed on slave ${payload.slaveAccountNumber}`,
      );
      await this.replicationEngine.confirmExecution(
        payload.replicationEventId,
        true,
        { slaveTicket: repEvent.slaveTicket },
      );
    } else {
      const errMsg = String(
        result?.data?.comment || result?.error || 'Close failed',
      );
      this.logger.warn(`❌ Close rejected: ${errMsg}`);
      await this.replicationEngine.confirmExecution(
        payload.replicationEventId,
        false,
        { errorMessage: errMsg },
      );
    }
  }

  private async executeModify(payload: ExecutionPayload): Promise<void> {
    const repEvent = await this.prisma.replicationEvent.findFirst({
      where: {
        masterTicket: payload.masterTicket,
        slaveId: payload.slaveId,
        status: 'SUCCESS',
      },
      orderBy: { initiatedAt: 'desc' },
      select: { slaveTicket: true },
    });

    if (!repEvent?.slaveTicket) {
      this.logger.warn(
        `No matching slave ticket for master ticket ${payload.masterTicket} — cannot modify`,
      );
      await this.replicationEngine.confirmExecution(
        payload.replicationEventId,
        false,
        { errorMessage: 'No matching slave ticket for modify' },
      );
      return;
    }

    const creds = await this.getSlaveCredentials(payload.slaveId, payload.slaveAccountNumber);

    const body: Record<string, unknown> = {
      sl: payload.stopLoss || 0,
      tp: payload.takeProfit || 0,
    };
    if (creds) {
      body.login = creds.login;
      body.password = creds.password;
      body.server = creds.server;
    }

    const result = await this.callMt5Api(
      'PATCH',
      `/api/mt5/order/${repEvent.slaveTicket}`,
      body,
    );

    if (result?.success) {
      this.logger.log(
        `✅ Position ${repEvent.slaveTicket} modified on slave ${payload.slaveAccountNumber}`,
      );
      await this.replicationEngine.confirmExecution(
        payload.replicationEventId,
        true,
        { slaveTicket: repEvent.slaveTicket },
      );
    } else {
      const errMsg = String(
        result?.data?.comment || result?.error || 'Modify failed',
      );
      await this.replicationEngine.confirmExecution(
        payload.replicationEventId,
        false,
        { errorMessage: errMsg },
      );
    }
  }

  /* ──────────────────── Helpers ──────────────────── */

  /**
   * Get slave MT5 credentials. Checks:
   *  1. Environment variables (SLAVE_MT5_LOGIN, SLAVE_MT5_PASSWORD, SLAVE_MT5_SERVER)
   *  2. `riskConfig` JSON on the slave record (mt5Login, mt5Password, mt5Server)
   *  3. Returns null if unavailable (order will run on current connection)
   */
  private async getSlaveCredentials(
    slaveId: string,
    accountNumber: string,
  ): Promise<{ login: number; password: string; server: string } | null> {
    // First try env vars (quick override for single-slave setups)
    const envLogin = this.configService.get<string>('SLAVE_MT5_LOGIN');
    const envPassword = this.configService.get<string>('SLAVE_MT5_PASSWORD');
    const envServer = this.configService.get<string>('SLAVE_MT5_SERVER');

    if (envLogin && envPassword && envServer) {
      // If the env login matches this slave, use it
      if (envLogin === accountNumber || !accountNumber) {
        return {
          login: parseInt(envLogin, 10),
          password: envPassword,
          server: envServer,
        };
      }
    }

    // Try riskConfig JSON field on the slave account
    try {
      const slave = await this.prisma.slaveAccount.findUnique({
        where: { id: slaveId },
        select: { riskConfig: true, serverName: true },
      });

      if (slave?.riskConfig) {
        const rc = slave.riskConfig as Record<string, unknown>;
        if (rc.mt5Login && rc.mt5Password) {
          return {
            login: Number(rc.mt5Login),
            password: String(rc.mt5Password),
            server: String(rc.mt5Server || slave.serverName),
          };
        }
      }
    } catch {
      // DB error — proceed without credentials
    }

    return null;
  }

  private async callMt5Api(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<{
    success?: boolean;
    data?: Record<string, unknown>;
    error?: string;
  } | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const options: RequestInit = {
        method,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.mt5InternalApiKey}`,
        },
      };
      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${this.mt5BaseUrl}${path}`, options);
      clearTimeout(timeout);

      return (await response.json()) as {
        success?: boolean;
        data?: Record<string, unknown>;
        error?: string;
      };
    } catch (err) {
      this.logger.error(
        `MT5 API call failed: ${method} ${path} — ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
