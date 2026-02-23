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
 * TD Ameritrade / Charles Schwab broker adapter.
 * Uses OAuth2 authorization code flow.
 * Docs: https://developer.schwab.com/ (successor to TDA API)
 */
@Injectable()
export class TdAmeritradeAdapter extends BaseBrokerAdapter {
  readonly brokerId = 'td_ameritrade';
  readonly brokerName = 'TD Ameritrade / Schwab';

  private baseUrl = 'https://api.schwabapi.com/trader/v1';
  private authUrl = 'https://api.schwabapi.com/v1/oauth';

  constructor(httpService: HttpService) {
    super(httpService, 120);
  }

  async authenticate(credentials: BrokerCredentials): Promise<AuthResult> {
    this.credentials = credentials;

    if (credentials.accessToken) {
      // Verify existing token
      try {
        const account = await this.request<any>(
          'GET',
          `${this.baseUrl}/accounts`,
        );
        const accountId = account?.[0]?.securitiesAccount?.accountId;
        return {
          authenticated: true,
          accountId,
          metadata: { type: account?.[0]?.securitiesAccount?.type },
        };
      } catch {
        // Token might be expired; try refresh
        if (credentials.refreshToken) {
          return this.refreshAccessToken(credentials);
        }
        return { authenticated: false };
      }
    }

    return { authenticated: false };
  }

  async disconnect(): Promise<void> {
    this.credentials = null;
  }

  /**
   * Generate the OAuth2 authorization URL.
   */
  getAuthorizationUrl(clientId: string, redirectUri: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'api',
    });
    return `${this.authUrl}/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens.
   */
  async exchangeCode(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ): Promise<AuthResult> {
    const tokenData = await this.request<any>('POST', `${this.authUrl}/token`, {
      data: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
      }).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
    });

    this.credentials = {
      ...this.credentials,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
    };

    return {
      authenticated: true,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    };
  }

  protected getAuthHeaders(): Record<string, string> {
    if (!this.credentials?.accessToken) return {};
    return {
      Authorization: `Bearer ${this.credentials.accessToken}`,
    };
  }

  async fetchTrades(
    startDate: Date,
    endDate: Date,
  ): Promise<NormalizedTrade[]> {
    this.ensureAuthenticated();

    const transactions = await this.request<any[]>(
      'GET',
      `${this.baseUrl}/accounts/${this.credentials!.accountId}/transactions`,
      {
        params: {
          type: 'TRADE',
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
      },
    );

    return (transactions || []).map((t) => this.normalizeTrade(t));
  }

  async getPositions(): Promise<NormalizedPosition[]> {
    this.ensureAuthenticated();

    const account = await this.request<any>(
      'GET',
      `${this.baseUrl}/accounts/${this.credentials!.accountId}`,
      { params: { fields: 'positions' } },
    );

    const positions = account?.securitiesAccount?.positions || [];
    return positions.map((pos: any) => ({
      instrument: pos.instrument?.symbol || 'UNKNOWN',
      side: pos.longQuantity > 0 ? ('long' as const) : ('short' as const),
      quantity: pos.longQuantity || pos.shortQuantity || 0,
      averageEntryPrice: pos.averagePrice,
      currentPrice: pos.currentDayProfitLossPercentage
        ? pos.averagePrice * (1 + pos.currentDayProfitLossPercentage / 100)
        : undefined,
      unrealizedPnl: pos.currentDayProfitLoss,
      marketValue: pos.marketValue,
    }));
  }

  async getAccountInfo(): Promise<AccountInfo> {
    this.ensureAuthenticated();

    const accounts = await this.request<any[]>(
      'GET',
      `${this.baseUrl}/accounts`,
    );

    const account = accounts?.[0]?.securitiesAccount;
    return {
      accountId: account?.accountId || '',
      currency: 'USD',
      balance: account?.currentBalances?.cashBalance || 0,
      buyingPower: account?.currentBalances?.buyingPower,
      equity: account?.currentBalances?.equity,
      marginUsed: account?.currentBalances?.maintenanceRequirement,
      status: account?.status || 'active',
    };
  }

  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    this.ensureAuthenticated();

    const tdOrder: any = {
      orderType: order.type.toUpperCase(),
      session: 'NORMAL',
      duration: (order.timeInForce || 'DAY').toUpperCase(),
      orderStrategyType: 'SINGLE',
      orderLegCollection: [
        {
          instruction: order.side === 'buy' ? 'BUY' : 'SELL',
          quantity: order.quantity,
          instrument: {
            symbol: order.instrument,
            assetType: 'EQUITY',
          },
        },
      ],
    };

    if (order.limitPrice) tdOrder.price = order.limitPrice.toString();
    if (order.stopPrice) tdOrder.stopPrice = order.stopPrice.toString();

    try {
      await this.request(
        'POST',
        `${this.baseUrl}/accounts/${this.credentials!.accountId}/orders`,
        { data: tdOrder },
      );
      return { orderId: '', status: 'pending' };
    } catch (error: any) {
      return { orderId: '', status: 'rejected', message: error.message };
    }
  }

  async cancelOrder(
    orderId: string,
  ): Promise<{ success: boolean; message?: string }> {
    this.ensureAuthenticated();

    try {
      await this.request(
        'DELETE',
        `${this.baseUrl}/accounts/${this.credentials!.accountId}/orders/${orderId}`,
      );
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  private async refreshAccessToken(
    credentials: BrokerCredentials,
  ): Promise<AuthResult> {
    try {
      const tokenData = await this.httpService.axiosRef.post(
        `${this.authUrl}/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: credentials.refreshToken!,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${credentials.apiKey}:${credentials.apiSecret}`).toString('base64')}`,
          },
        },
      );

      this.credentials = {
        ...credentials,
        accessToken: tokenData.data.access_token,
        refreshToken: tokenData.data.refresh_token || credentials.refreshToken,
      };

      return {
        authenticated: true,
        expiresAt: new Date(Date.now() + tokenData.data.expires_in * 1000),
      };
    } catch {
      return { authenticated: false };
    }
  }

  private normalizeTrade(transaction: any): NormalizedTrade {
    return {
      externalId: transaction.transactionId?.toString() || '',
      instrument: transaction.transactionItem?.instrument?.symbol || 'UNKNOWN',
      direction:
        transaction.transactionItem?.instruction === 'BUY' ? 'long' : 'short',
      entryPrice: transaction.transactionItem?.price || 0,
      quantity: transaction.transactionItem?.amount || 0,
      commission: transaction.fees?.commission,
      entryTimestamp: new Date(transaction.transactionDate),
      status: 'closed',
      rawData: transaction,
    };
  }
}
