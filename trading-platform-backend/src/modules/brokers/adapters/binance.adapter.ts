import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as crypto from 'crypto';
import { BaseBrokerAdapter } from './base.adapter';
import {
  BrokerCredentials,
  AuthResult,
  NormalizedTrade,
  NormalizedPosition,
  AccountInfo,
  OrderRequest,
  OrderResponse,
} from './adapter.interface';

/**
 * Binance cryptocurrency exchange adapter.
 * Uses HMAC-SHA256 signed requests for authenticated endpoints.
 * Docs: https://binance-docs.github.io/apidocs/spot/en/
 */
@Injectable()
export class BinanceAdapter extends BaseBrokerAdapter {
  readonly brokerId = 'binance';
  readonly brokerName = 'Binance';

  private baseUrl = 'https://api.binance.com';

  constructor(httpService: HttpService) {
    super(httpService, 1200); // 1200 req/min
  }

  async authenticate(credentials: BrokerCredentials): Promise<AuthResult> {
    this.credentials = credentials;

    // Use testnet if specified
    if (credentials.testnet) {
      this.baseUrl = 'https://testnet.binance.vision';
    }

    try {
      const account = await this.signedRequest<any>('GET', '/api/v3/account');
      return {
        authenticated: true,
        metadata: {
          canTrade: account.canTrade,
          canDeposit: account.canDeposit,
          canWithdraw: account.canWithdraw,
          accountType: account.accountType,
        },
      };
    } catch (error: any) {
      this.logger.error('Binance authentication failed', error.message);
      return { authenticated: false };
    }
  }

  async disconnect(): Promise<void> {
    this.credentials = null;
  }

  async fetchTrades(
    startDate: Date,
    endDate: Date,
  ): Promise<NormalizedTrade[]> {
    this.ensureAuthenticated();

    // Binance requires symbol for trade history; fetch all traded symbols first
    const account = await this.signedRequest<any>('GET', '/api/v3/account');
    const activeAssets = account.balances
      .filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map((b: any) => b.asset)
      .filter((a: string) => a !== 'USDT' && a !== 'BUSD' && a !== 'USD');

    const allTrades: NormalizedTrade[] = [];

    for (const asset of activeAssets.slice(0, 10)) {
      try {
        const trades = await this.signedRequest<any[]>(
          'GET',
          '/api/v3/myTrades',
          {
            symbol: `${asset}USDT`,
            startTime: startDate.getTime(),
            endTime: endDate.getTime(),
            limit: 1000,
          },
        );
        allTrades.push(
          ...(trades || []).map((t) => this.normalizeTrade(t, `${asset}USDT`)),
        );
      } catch {
        // Symbol pair might not exist, skip
      }
    }

    return allTrades;
  }

  async getPositions(): Promise<NormalizedPosition[]> {
    this.ensureAuthenticated();

    const account = await this.signedRequest<any>('GET', '/api/v3/account');

    return account.balances
      .filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map((b: any) => ({
        instrument: b.asset,
        side: 'long' as const,
        quantity: parseFloat(b.free) + parseFloat(b.locked),
        averageEntryPrice: 0, // Binance spot doesn't provide avg entry
        currentPrice: undefined,
        unrealizedPnl: undefined,
        marketValue: undefined,
      }));
  }

  async getAccountInfo(): Promise<AccountInfo> {
    this.ensureAuthenticated();

    const account = await this.signedRequest<any>('GET', '/api/v3/account');

    const usdtBalance = account.balances.find((b: any) => b.asset === 'USDT');
    const balance = usdtBalance
      ? parseFloat(usdtBalance.free) + parseFloat(usdtBalance.locked)
      : 0;

    return {
      accountId: account.accountType || 'SPOT',
      currency: 'USDT',
      balance,
      buyingPower: usdtBalance ? parseFloat(usdtBalance.free) : 0,
      status: account.canTrade ? 'active' : 'restricted',
    };
  }

  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    this.ensureAuthenticated();

    const binanceOrder: any = {
      symbol: order.instrument,
      side: order.side.toUpperCase(),
      type: this.mapOrderType(order.type),
      quantity: order.quantity.toString(),
    };

    if (order.timeInForce && order.type !== 'market') {
      binanceOrder.timeInForce = order.timeInForce.toUpperCase();
    }
    if (order.limitPrice) binanceOrder.price = order.limitPrice.toString();
    if (order.stopPrice) binanceOrder.stopPrice = order.stopPrice.toString();

    // Market orders don't need timeInForce
    if (order.type === 'market') {
      delete binanceOrder.timeInForce;
    } else if (!binanceOrder.timeInForce) {
      binanceOrder.timeInForce = 'GTC';
    }

    const result = await this.signedRequest<any>(
      'POST',
      '/api/v3/order',
      binanceOrder,
    );

    return {
      orderId: result.orderId?.toString(),
      status: this.mapBinanceOrderStatus(result.status),
      filledQuantity: result.executedQty
        ? parseFloat(result.executedQty)
        : undefined,
      filledPrice: result.fills?.length
        ? parseFloat(result.fills[0].price)
        : undefined,
    };
  }

  async cancelOrder(
    orderId: string,
  ): Promise<{ success: boolean; message?: string }> {
    this.ensureAuthenticated();

    try {
      // Need symbol to cancel — store it or require it
      await this.signedRequest('DELETE', '/api/v3/order', {
        orderId: parseInt(orderId, 10),
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Create an HMAC-SHA256 signed request to Binance.
   */
  private async signedRequest<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    params: Record<string, any> = {},
  ): Promise<T> {
    const timestamp = Date.now();
    const queryParams = { ...params, timestamp };

    const queryString = Object.entries(queryParams)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    const signature = crypto
      .createHmac('sha256', this.credentials!.apiSecret || '')
      .update(queryString)
      .digest('hex');

    const url = `${this.baseUrl}${path}`;
    const fullParams = { ...queryParams, signature };

    return this.request<T>(method, url, {
      params: method === 'GET' || method === 'DELETE' ? fullParams : undefined,
      data:
        method === 'POST'
          ? new URLSearchParams(fullParams as any).toString()
          : undefined,
      headers: {
        'X-MBX-APIKEY': this.credentials!.apiKey || '',
        ...(method === 'POST'
          ? { 'Content-Type': 'application/x-www-form-urlencoded' }
          : {}),
      },
    });
  }

  private normalizeTrade(trade: any, symbol: string): NormalizedTrade {
    return {
      externalId: trade.id?.toString(),
      instrument: symbol,
      direction: trade.isBuyer ? 'long' : 'short',
      entryPrice: parseFloat(trade.price),
      quantity: parseFloat(trade.qty),
      commission: parseFloat(trade.commission),
      entryTimestamp: new Date(trade.time),
      status: 'closed',
      rawData: trade,
    };
  }

  private mapOrderType(type: string): string {
    const map: Record<string, string> = {
      market: 'MARKET',
      limit: 'LIMIT',
      stop: 'STOP_LOSS',
      stop_limit: 'STOP_LOSS_LIMIT',
    };
    return map[type] || 'MARKET';
  }

  private mapBinanceOrderStatus(status: string): OrderResponse['status'] {
    const map: Record<string, OrderResponse['status']> = {
      NEW: 'pending',
      PARTIALLY_FILLED: 'partially_filled',
      FILLED: 'filled',
      CANCELED: 'cancelled',
      REJECTED: 'rejected',
      EXPIRED: 'cancelled',
    };
    return map[status] || 'pending';
  }
}
