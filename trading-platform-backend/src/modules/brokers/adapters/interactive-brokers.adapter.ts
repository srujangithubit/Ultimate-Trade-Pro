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
 * Interactive Brokers adapter via Client Portal API (REST gateway).
 * Docs: https://interactivebrokers.github.io/cpwebapi/
 *
 * Requires the IB Gateway or TWS to be running locally with
 * the Client Portal API enabled.
 */
@Injectable()
export class InteractiveBrokersAdapter extends BaseBrokerAdapter {
  readonly brokerId = 'interactive_brokers';
  readonly brokerName = 'Interactive Brokers';

  private baseUrl = 'https://localhost:5000/v1/api';

  constructor(httpService: HttpService) {
    super(httpService, 60); // conservative rate limit
  }

  async authenticate(credentials: BrokerCredentials): Promise<AuthResult> {
    this.credentials = credentials;

    if (credentials.gatewayUrl) {
      this.baseUrl = credentials.gatewayUrl as string;
    }

    try {
      // Client Portal uses session-based auth via /iserver/auth/status
      const status = await this.request<any>(
        'POST',
        `${this.baseUrl}/iserver/auth/status`,
      );

      if (status.authenticated) {
        return {
          authenticated: true,
          accountId: credentials.accountId,
          metadata: { connected: status.connected },
        };
      }

      // Attempt re-authentication
      await this.request('POST', `${this.baseUrl}/iserver/reauthenticate`);
      return {
        authenticated: true,
        accountId: credentials.accountId,
      };
    } catch (error: any) {
      this.logger.error('IB authentication failed', error.message);
      return { authenticated: false };
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.request('POST', `${this.baseUrl}/logout`);
    } catch {
      // Best-effort logout
    }
    this.credentials = null;
  }

  async fetchTrades(
    startDate: Date,
    endDate: Date,
  ): Promise<NormalizedTrade[]> {
    this.ensureAuthenticated();

    const accountId = this.credentials!.accountId;
    const trades = await this.request<any>(
      'GET',
      `${this.baseUrl}/iserver/account/trades`,
    );

    const filtered = (trades || []).filter((t: any) => {
      const tradeTime = new Date(t.trade_time_r);
      return tradeTime >= startDate && tradeTime <= endDate;
    });

    return filtered.map((trade: any) => this.normalizeTrade(trade));
  }

  async getPositions(): Promise<NormalizedPosition[]> {
    this.ensureAuthenticated();
    const accountId = this.credentials!.accountId;

    const result = await this.request<any>(
      'GET',
      `${this.baseUrl}/portfolio/${accountId}/positions/0`,
    );

    return (result || []).map((pos: any) => ({
      instrument: pos.contractDesc || pos.ticker,
      side: pos.position > 0 ? ('long' as const) : ('short' as const),
      quantity: Math.abs(pos.position),
      averageEntryPrice: pos.avgCost,
      currentPrice: pos.mktPrice,
      unrealizedPnl: pos.unrealizedPnl,
      marketValue: pos.mktValue,
    }));
  }

  async getAccountInfo(): Promise<AccountInfo> {
    this.ensureAuthenticated();
    const accountId = this.credentials!.accountId;

    const summary = await this.request<any>(
      'GET',
      `${this.baseUrl}/portfolio/${accountId}/summary`,
    );

    return {
      accountId: accountId!,
      currency: summary?.totalcashvalue?.currency || 'USD',
      balance: summary?.totalcashvalue?.amount || 0,
      buyingPower: summary?.buyingpower?.amount,
      equity: summary?.netliquidation?.amount,
      marginUsed: summary?.maintmarginreq?.amount,
      status: 'active',
    };
  }

  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    this.ensureAuthenticated();
    const accountId = this.credentials!.accountId;

    // First, search for the contract
    const contracts = await this.request<any[]>(
      'GET',
      `${this.baseUrl}/iserver/secdef/search`,
      { params: { symbol: order.instrument } },
    );

    if (!contracts || contracts.length === 0) {
      return {
        orderId: '',
        status: 'rejected',
        message: `Contract not found for ${order.instrument}`,
      };
    }

    const conid = contracts[0].conid;
    const ibOrder: any = {
      conid,
      orderType: this.mapOrderType(order.type),
      side: order.side.toUpperCase(),
      quantity: order.quantity,
      tif: (order.timeInForce || 'DAY').toUpperCase(),
    };

    if (order.limitPrice) ibOrder.price = order.limitPrice;
    if (order.stopPrice) ibOrder.auxPrice = order.stopPrice;

    const result = await this.request<any[]>(
      'POST',
      `${this.baseUrl}/iserver/account/${accountId}/orders`,
      { data: { orders: [ibOrder] } },
    );

    const orderResult = result?.[0];
    return {
      orderId: orderResult?.order_id || '',
      status: orderResult?.order_status === 'Submitted' ? 'pending' : 'pending',
      message: orderResult?.text,
    };
  }

  async cancelOrder(
    orderId: string,
  ): Promise<{ success: boolean; message?: string }> {
    this.ensureAuthenticated();
    const accountId = this.credentials!.accountId;

    try {
      await this.request(
        'DELETE',
        `${this.baseUrl}/iserver/account/${accountId}/order/${orderId}`,
      );
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  private normalizeTrade(trade: any): NormalizedTrade {
    return {
      externalId:
        trade.execution_id || trade.order_ref || String(trade.trade_time_r),
      instrument: trade.symbol || trade.contract?.symbol || 'UNKNOWN',
      direction: trade.side === 'B' || trade.side === 'BOT' ? 'long' : 'short',
      entryPrice: trade.price,
      quantity: Math.abs(trade.size || trade.position),
      commission: trade.commission,
      entryTimestamp: new Date(trade.trade_time_r || trade.trade_time),
      status: 'closed',
      rawData: trade,
    };
  }

  private mapOrderType(type: string): string {
    const map: Record<string, string> = {
      market: 'MKT',
      limit: 'LMT',
      stop: 'STP',
      stop_limit: 'STP LMT',
    };
    return map[type] || 'MKT';
  }
}
