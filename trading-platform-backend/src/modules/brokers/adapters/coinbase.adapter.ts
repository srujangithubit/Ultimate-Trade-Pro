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
 * Coinbase Advanced Trade API adapter.
 * Supports API key authentication with HMAC-SHA256 signing.
 * Docs: https://docs.cdp.coinbase.com/advanced-trade/docs/
 */
@Injectable()
export class CoinbaseAdapter extends BaseBrokerAdapter {
  readonly brokerId = 'coinbase';
  readonly brokerName = 'Coinbase';

  private baseUrl = 'https://api.coinbase.com';

  constructor(httpService: HttpService) {
    super(httpService, 100); // 100 req/min for private endpoints
  }

  async authenticate(credentials: BrokerCredentials): Promise<AuthResult> {
    this.credentials = credentials;

    try {
      const accounts = await this.coinbaseRequest<any>(
        'GET',
        '/api/v3/brokerage/accounts',
      );
      return {
        authenticated: true,
        accountId: accounts?.accounts?.[0]?.uuid,
        metadata: {
          accountCount: accounts?.accounts?.length,
        },
      };
    } catch (error: any) {
      this.logger.error('Coinbase authentication failed', error.message);
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

    const fills = await this.coinbaseRequest<any>(
      'GET',
      '/api/v3/brokerage/orders/historical/fills',
      {
        start_sequence_timestamp: startDate.toISOString(),
        end_sequence_timestamp: endDate.toISOString(),
        limit: 100,
      },
    );

    return (fills?.fills || []).map((fill: any) => this.normalizeTrade(fill));
  }

  async getPositions(): Promise<NormalizedPosition[]> {
    this.ensureAuthenticated();

    const accounts = await this.coinbaseRequest<any>(
      'GET',
      '/api/v3/brokerage/accounts',
    );

    return (accounts?.accounts || [])
      .filter(
        (acc: any) =>
          parseFloat(acc.available_balance?.value || '0') > 0 &&
          acc.currency !== 'USD' &&
          acc.currency !== 'USDC',
      )
      .map((acc: any) => ({
        instrument: acc.currency,
        side: 'long' as const,
        quantity: parseFloat(acc.available_balance?.value || '0'),
        averageEntryPrice: 0,
        currentPrice: undefined,
        unrealizedPnl: undefined,
        marketValue: undefined,
      }));
  }

  async getAccountInfo(): Promise<AccountInfo> {
    this.ensureAuthenticated();

    const accounts = await this.coinbaseRequest<any>(
      'GET',
      '/api/v3/brokerage/accounts',
    );

    const usdAccount = accounts?.accounts?.find(
      (a: any) => a.currency === 'USD' || a.currency === 'USDC',
    );

    return {
      accountId: usdAccount?.uuid || '',
      currency: usdAccount?.currency || 'USD',
      balance: parseFloat(usdAccount?.available_balance?.value || '0'),
      buyingPower: parseFloat(usdAccount?.available_balance?.value || '0'),
      status: usdAccount?.active ? 'active' : 'inactive',
    };
  }

  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    this.ensureAuthenticated();

    const clientOrderId = crypto.randomUUID();
    const cbOrder: any = {
      client_order_id: clientOrderId,
      product_id: order.instrument, // e.g. "BTC-USD"
      side: order.side.toUpperCase(),
      order_configuration: this.buildOrderConfig(order),
    };

    try {
      const result = await this.coinbaseRequest<any>(
        'POST',
        '/api/v3/brokerage/orders',
        undefined,
        cbOrder,
      );

      return {
        orderId: result?.success_response?.order_id || clientOrderId,
        status: result?.success ? 'pending' : 'rejected',
        message: result?.failure_response?.error,
      };
    } catch (error: any) {
      return {
        orderId: clientOrderId,
        status: 'rejected',
        message: error.message,
      };
    }
  }

  async cancelOrder(
    orderId: string,
  ): Promise<{ success: boolean; message?: string }> {
    this.ensureAuthenticated();

    try {
      await this.coinbaseRequest(
        'POST',
        '/api/v3/brokerage/orders/batch_cancel',
        undefined,
        { order_ids: [orderId] },
      );
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Make an authenticated request to Coinbase with HMAC-SHA256 signing.
   */
  private async coinbaseRequest<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    params?: Record<string, any>,
    body?: any,
  ): Promise<T> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyStr = body ? JSON.stringify(body) : '';
    const message = `${timestamp}${method}${path}${bodyStr}`;

    const signature = crypto
      .createHmac('sha256', this.credentials!.apiSecret || '')
      .update(message)
      .digest('hex');

    return this.request<T>(method, `${this.baseUrl}${path}`, {
      params,
      data: body,
      headers: {
        'CB-ACCESS-KEY': this.credentials!.apiKey || '',
        'CB-ACCESS-SIGN': signature,
        'CB-ACCESS-TIMESTAMP': timestamp,
        'Content-Type': 'application/json',
      },
    });
  }

  private buildOrderConfig(order: OrderRequest): any {
    switch (order.type) {
      case 'market':
        return {
          market_market_ioc: {
            quote_size: (order.quantity * (order.limitPrice || 1)).toString(),
          },
        };
      case 'limit':
        return {
          limit_limit_gtc: {
            base_size: order.quantity.toString(),
            limit_price: order.limitPrice!.toString(),
            post_only: false,
          },
        };
      case 'stop':
        return {
          stop_limit_stop_limit_gtc: {
            base_size: order.quantity.toString(),
            limit_price: (order.limitPrice || order.stopPrice!).toString(),
            stop_price: order.stopPrice!.toString(),
          },
        };
      case 'stop_limit':
        return {
          stop_limit_stop_limit_gtc: {
            base_size: order.quantity.toString(),
            limit_price: order.limitPrice!.toString(),
            stop_price: order.stopPrice!.toString(),
          },
        };
      default:
        return {
          market_market_ioc: {
            quote_size: order.quantity.toString(),
          },
        };
    }
  }

  private normalizeTrade(fill: any): NormalizedTrade {
    return {
      externalId: fill.trade_id || fill.entry_id || '',
      instrument: fill.product_id || '',
      direction: fill.side === 'BUY' ? 'long' : 'short',
      entryPrice: parseFloat(fill.price || '0'),
      quantity: parseFloat(fill.size || '0'),
      commission: parseFloat(fill.commission || '0'),
      entryTimestamp: new Date(fill.trade_time),
      status: 'closed',
      rawData: fill,
    };
  }
}
