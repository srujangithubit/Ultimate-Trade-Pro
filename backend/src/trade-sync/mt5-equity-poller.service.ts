import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MasterService } from './master/master.service';
import { SlaveService } from './slave/slave.service';

/**
 * Periodically polls the MT5 Node server for live account data
 * (equity, balance, floatingPnL) and pushes heartbeats into
 * the trade-sync pipeline so the frontend receives real-time updates.
 *
 * Updates both master AND slave accounts:
 *  - Masters: matched by account number or fallback to all
 *  - Slaves:  matched by account number, or all slaves in the
 *             same sync groups as any updated master
 */
@Injectable()
export class Mt5EquityPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Mt5EquityPollerService.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private readonly mt5BaseUrl: string;
  private readonly pollIntervalMs: number;
  private readonly mt5InternalApiKey: string;
  private polling = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly masterService: MasterService,
    private readonly slaveService: SlaveService,
  ) {
    this.mt5BaseUrl =
      this.configService.get<string>('MT5_SERVER_URL') ||
      'http://localhost:3001';
    this.mt5InternalApiKey =
      this.configService.get<string>('MT5_INTERNAL_API_KEY') || '';
    this.pollIntervalMs =
      parseInt(
        this.configService.get<string>('MT5_POLL_INTERVAL_MS') || '3000',
        10,
      );
  }

  onModuleInit() {
    this.logger.log(
      `Starting MT5 equity poller (interval: ${this.pollIntervalMs}ms, url: ${this.mt5BaseUrl})`,
    );
    this.intervalHandle = setInterval(() => {
      void this.poll();
    }, this.pollIntervalMs);

    // Fire one poll immediately on startup
    void this.poll();
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.logger.log('MT5 equity poller stopped');
  }

  private async poll(): Promise<void> {
    // Guard against overlapping polls
    if (this.polling) return;
    this.polling = true;

    try {
      // 1. Fetch live account info from the MT5 Node server
      const accountData = await this.fetchMt5Account();
      if (!accountData) return;

      const loginStr = String(accountData.login);
      const equityNum = Number(accountData.equity) || 0;
      const balanceNum = Number(accountData.balance) || 0;
      const profitNum = Number(accountData.profit) || 0;

      // Track which sync groups were updated so we can update slaves
      const updatedSyncGroupIds: string[] = [];

      // 2. Find matching master account(s) by account number
      let masters = await this.prisma.masterAccount.findMany({
        where: { accountNumber: loginStr },
        select: { id: true, syncGroupId: true, accountNumber: true },
      });

      // Fallback: if no exact match, update all masters
      if (masters.length === 0) {
        masters = await this.prisma.masterAccount.findMany({
          select: { id: true, syncGroupId: true, accountNumber: true },
        });
      }

      // 3. Push heartbeat for each master
      for (const master of masters) {
        await this.masterService.updateMasterHeartbeat(master.id, {
          accountId: master.id,
          equity: equityNum,
          balance: balanceNum,
          floatingPnL: profitNum,
          accountNumber: master.accountNumber,
        });
        updatedSyncGroupIds.push(master.syncGroupId);
      }

      // 4. Update slave accounts
      //    a) Slaves whose accountNumber matches the connected MT5 login
      //    b) All slaves in the same sync groups (they share the same MT5 connection context)
      const slaves = await this.prisma.slaveAccount.findMany({
        where: {
          OR: [
            { accountNumber: loginStr },
            ...(updatedSyncGroupIds.length > 0
              ? [{ syncGroupId: { in: updatedSyncGroupIds } }]
              : []),
          ],
        },
        select: { id: true, syncGroupId: true, accountNumber: true },
      });

      for (const slave of slaves) {
        // If the slave's account number matches the connected MT5 login,
        // use the live data directly
        if (slave.accountNumber === loginStr) {
          await this.slaveService.updateSlaveHeartbeat(slave.id, {
            equity: equityNum,
            balance: balanceNum,
            floatingPnL: profitNum,
            accountNumber: slave.accountNumber,
          });
        } else {
          // For slaves on different brokers/accounts, try fetching from
          // a dedicated endpoint or use the last known MT5 data as a
          // connectivity heartbeat (marks them as connected)
          await this.updateSlaveFromDedicatedSource(slave);
        }
      }

      this.logger.debug(
        `Heartbeat: ${masters.length} master(s), ${slaves.length} slave(s) | equity=${equityNum}, balance=${balanceNum}, pnl=${profitNum}`,
      );
    } catch (err) {
      this.logger.warn(
        `MT5 poll failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.polling = false;
    }
  }

  /**
   * Attempts to fetch equity for a slave account that is on a different
   * MT5 login than the currently connected one.
   *
   * Strategy: check if there's a dedicated MT5 bridge for this account
   * (e.g., via a second Python bridge), otherwise just mark it connected
   * with whatever data it last had.
   */
  private async updateSlaveFromDedicatedSource(slave: {
    id: string;
    syncGroupId: string;
    accountNumber: string;
  }): Promise<void> {
    try {
      // Try fetching from a slave-specific endpoint if configured
      // Format: GET /api/mt5/account/:accountNumber
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(
        `${this.mt5BaseUrl}/api/mt5/account/${slave.accountNumber}`,
        {
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${this.mt5InternalApiKey}`,
          },
        },
      );

      clearTimeout(timeout);

      if (response.ok) {
        const json = (await response.json()) as { data?: Mt5AccountInfo };
        if (json.data) {
          await this.slaveService.updateSlaveHeartbeat(slave.id, {
            equity: Number(json.data.equity) || 0,
            balance: Number(json.data.balance) || 0,
            floatingPnL: Number(json.data.profit) || 0,
            accountNumber: slave.accountNumber,
          });
          return;
        }
      }
    } catch {
      // No dedicated source available — that's fine
    }

    // Fallback: just mark the slave as connected with last known data
    // so the heartbeat timestamp stays fresh
    const existing = await this.prisma.slaveAccount.findUnique({
      where: { id: slave.id },
      select: { equity: true, balance: true, floatingPnL: true },
    });

    if (existing) {
      await this.slaveService.updateSlaveHeartbeat(slave.id, {
        equity: Number(existing.equity) || 0,
        balance: Number(existing.balance) || 0,
        floatingPnL: Number(existing.floatingPnL) || 0,
        accountNumber: slave.accountNumber,
      });
    }
  }

  private async fetchMt5Account(): Promise<Mt5AccountInfo | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.mt5BaseUrl}/api/mt5/account`, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.mt5InternalApiKey}`,
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn(`MT5 account endpoint returned ${response.status}`);
        return null;
      }

      const json = (await response.json()) as { data?: Mt5AccountInfo };
      return json.data ?? null;
    } catch (err) {
      // Suppress frequent timeout / connection errors to avoid log spam
      if (
        err instanceof Error &&
        (err.name === 'AbortError' || err.message.includes('ECONNREFUSED'))
      ) {
        return null;
      }
      throw err;
    }
  }
}

interface Mt5AccountInfo {
  login: number;
  balance: number;
  equity: number;
  profit: number;
  margin: number;
  margin_free: number;
  margin_level: number;
  name?: string;
  server?: string;
  currency?: string;
  leverage?: number;
}
