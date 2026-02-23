import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
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
 * Alpaca Markets broker adapter.
 * Uses REST API v2 with API key + secret authentication.
 * Docs: https://docs.alpaca.markets/reference
 */
@Injectable()
export class AlpacaAdapter extends BaseBrokerAdapter {
  readonly brokerId = 'alpaca';
  readonly brokerName = 'Alpaca Markets';

  private baseUrl = 'https://api.alpaca.markets';
  private dataUrl = 'https://data.alpaca.markets';

  constructor(httpService: HttpService) {
    super(httpService, 200); // 200 req/min
  }

  async authenticate(credentials: BrokerCredentials): Promise<AuthResult> {
    this.credentials = credentials;

    // Use paper trading URL if specified
    if (credentials.paper) {
      this.baseUrl = 'https://paper-api.alpaca.markets';
    }

    try {
      const account = await this.request<any>(
        'GET',
        `${this.baseUrl}/v2/account`,
      );
      return {
        authenticated: true,
        accountId: account.id,
        metadata: {
          status: account.status,
          currency: account.currency,
          buyingPower: account.buying_power,
        },
      };
    } catch (error: any) {
      return { authenticated: false };
    }
  }

  async disconnect(): Promise<void> {
    this.credentials = null;
  }

  protected getAuthHeaders(): Record<string, string> {
    if (!this.credentials) return {};
    return {
      'APCA-API-KEY-ID': this.credentials.apiKey || '',
      'APCA-API-SECRET-KEY': this.credentials.apiSecret || '',
    };
  }

  async fetchTrades(
    startDate: Date,
    endDate: Date,
  ): Promise<NormalizedTrade[]> {
    this.ensureAuthenticated();

    const activities = await this.request<any[]>(
      'GET',
      `${this.baseUrl}/v2/account/activities`,
      {
        params: {
          activity_types: 'FILL',
          after: startDate.toISOString(),
          until: endDate.toISOString(),
          direction: 'asc',
          page_size: 100,
        },
      },
    );

    return (activities || []).map((trade) => this.normalizeTrade(trade));
  }

  async getPositions(): Promise<NormalizedPosition[]> {
    this.ensureAuthenticated();

    const positions = await this.request<any[]>(
      'GET',
      `${this.baseUrl}/v2/positions`,
    );

    return (positions || []).map((pos) => ({
      instrument: pos.symbol,
      side: pos.side === 'long' ? ('long' as const) : ('short' as const),
      quantity: parseFloat(pos.qty),
      averageEntryPrice: parseFloat(pos.avg_entry_price),
      currentPrice: parseFloat(pos.current_price),
      unrealizedPnl: parseFloat(pos.unrealized_pl),
      marketValue: parseFloat(pos.market_value),
    }));
  }

  async getAccountInfo(): Promise<AccountInfo> {
    this.ensureAuthenticated();

    const account = await this.request<any>(
      'GET',
      `${this.baseUrl}/v2/account`,
    );

    return {
      accountId: account.id,
      currency: account.currency,
      balance: parseFloat(account.cash),
      buyingPower: parseFloat(account.buying_power),
      equity: parseFloat(account.equity),
      marginUsed: parseFloat(account.initial_margin),
      status: account.status,
    };
  }

  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    this.ensureAuthenticated();

    const alpacaOrder: any = {
      symbol: order.instrument,
      qty: order.quantity.toString(),
      side: order.side,
      type: order.type,
      time_in_force: order.timeInForce || 'day',
    };

    if (order.limitPrice) alpacaOrder.limit_price = order.limitPrice.toString();
    if (order.stopPrice) alpacaOrder.stop_price = order.stopPrice.toString();

    const result = await this.request<any>(
      'POST',
      `${this.baseUrl}/v2/orders`,
      { data: alpacaOrder },
    );

    return {
      orderId: result.id,
      status: this.mapOrderStatus(result.status),
      filledQuantity: result.filled_qty
        ? parseFloat(result.filled_qty)
        : undefined,
      filledPrice: result.filled_avg_price
        ? parseFloat(result.filled_avg_price)
        : undefined,
    };
  }

  async cancelOrder(
    orderId: string,
  ): Promise<{ success: boolean; message?: string }> {
    this.ensureAuthenticated();

    try {
      await this.request('DELETE', `${this.baseUrl}/v2/orders/${orderId}`);
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  private normalizeTrade(trade: any): NormalizedTrade {
    return {
      externalId: trade.id,
      instrument: trade.symbol,
      direction: trade.side === 'buy' ? 'long' : 'short',
      entryPrice: parseFloat(trade.price),
      quantity: parseFloat(trade.qty),
      commission: trade.commission ? parseFloat(trade.commission) : 0,
      entryTimestamp: new Date(trade.transaction_time),
      status: 'closed',
      rawData: trade,
    };
  }

  private mapOrderStatus(alpacaStatus: string): OrderResponse['status'] {
    const statusMap: Record<string, OrderResponse['status']> = {
      new: 'pending',
      accepted: 'pending',
      pending_new: 'pending',
      filled: 'filled',
      partially_filled: 'partially_filled',
      canceled: 'cancelled',
      expired: 'cancelled',
      rejected: 'rejected',
    };
    return statusMap[alpacaStatus] || 'pending';
  }
}
