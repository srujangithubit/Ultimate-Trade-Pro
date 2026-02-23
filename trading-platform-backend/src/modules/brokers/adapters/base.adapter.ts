import { Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import {
  BrokerAdapter,
  BrokerCredentials,
  AuthResult,
  NormalizedTrade,
  NormalizedPosition,
  AccountInfo,
  OrderRequest,
  OrderResponse,
} from './adapter.interface';
import { RateLimiter } from '../../../common/utils/rate-limiter.util';
import { withRetry, RetryOptions } from '../../../common/utils/retry.util';
import { IntegrationError } from '../../../common/filters/http-error.filter';

/**
 * Abstract base class for broker adapters providing shared retry,
 * rate-limiting, logging, and credential management.
 */
export abstract class BaseBrokerAdapter implements BrokerAdapter {
  abstract readonly brokerId: string;
  abstract readonly brokerName: string;

  protected readonly logger: Logger;
  protected readonly rateLimiter: RateLimiter;
  protected credentials: BrokerCredentials | null = null;

  protected readonly retryOptions: RetryOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 15000,
    jitter: true,
  };

  constructor(
    protected readonly httpService: HttpService,
    rateLimitPerMinute: number = 120,
  ) {
    this.logger = new Logger(this.constructor.name);
    this.rateLimiter = new RateLimiter(
      rateLimitPerMinute,
      rateLimitPerMinute / 60,
    );
  }

  /**
   * Perform an HTTP request with rate-limiting and retry logic.
   */
  protected async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    url: string,
    options: {
      params?: Record<string, any>;
      data?: any;
      headers?: Record<string, string>;
    } = {},
  ): Promise<T> {
    await this.rateLimiter.waitForToken();

    return withRetry(
      async () => {
        const response = await this.httpService.axiosRef.request<T>({
          method,
          url,
          params: options.params,
          data: options.data,
          headers: {
            ...this.getAuthHeaders(),
            ...options.headers,
          },
        });
        return response.data;
      },
      {
        ...this.retryOptions,
        logger: this.logger,
      },
    );
  }

  /**
   * Return auth headers for the current authenticated session.
   * Subclasses should override this.
   */
  protected getAuthHeaders(): Record<string, string> {
    return {};
  }

  /**
   * Ensure the adapter is authenticated before making API calls.
   */
  protected ensureAuthenticated(): void {
    if (!this.credentials) {
      throw new IntegrationError(
        this.brokerName,
        'Not authenticated. Call authenticate() first.',
        401,
      );
    }
  }

  abstract authenticate(credentials: BrokerCredentials): Promise<AuthResult>;
  abstract disconnect(): Promise<void>;
  abstract fetchTrades(
    startDate: Date,
    endDate: Date,
  ): Promise<NormalizedTrade[]>;
  abstract getPositions(): Promise<NormalizedPosition[]>;
  abstract getAccountInfo(): Promise<AccountInfo>;
  abstract placeOrder(order: OrderRequest): Promise<OrderResponse>;
  abstract cancelOrder(
    orderId: string,
  ): Promise<{ success: boolean; message?: string }>;
}
