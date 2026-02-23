import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { IntegrationError } from '../../common/filters/http-error.filter';

/**
 * OneSignal push notification service.
 * Docs: https://documentation.onesignal.com/reference
 */
@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly baseUrl = 'https://onesignal.com/api/v1';
  private readonly appId: string;
  private readonly apiKey: string;

  constructor(private readonly httpService: HttpService) {
    this.appId = process.env.ONESIGNAL_APP_ID || '';
    this.apiKey = process.env.ONESIGNAL_API_KEY || '';

    if (this.appId && this.apiKey) {
      this.logger.log('OneSignal push notifications initialized');
    } else {
      this.logger.warn(
        'OneSignal not configured. Push notifications disabled.',
      );
    }
  }

  private ensureConfigured(): void {
    if (!this.appId || !this.apiKey) {
      throw new IntegrationError(
        'OneSignal',
        'Push notifications not configured.',
        503,
      );
    }
  }

  /**
   * Send push notification to specific user(s).
   */
  async sendToUsers(
    userIds: string[],
    title: string,
    message: string,
    data?: Record<string, any>,
  ): Promise<{ notificationId: string }> {
    this.ensureConfigured();

    try {
      const response = await this.httpService.axiosRef.post(
        `${this.baseUrl}/notifications`,
        {
          app_id: this.appId,
          include_external_user_ids: userIds,
          headings: { en: title },
          contents: { en: message },
          data,
        },
        {
          headers: {
            Authorization: `Basic ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return { notificationId: response.data.id };
    } catch (error: any) {
      this.logger.error(`Push notification failed: ${error.message}`);
      throw new IntegrationError('OneSignal', `Push failed: ${error.message}`);
    }
  }

  /**
   * Send push notification to all subscribed users.
   */
  async sendToAll(
    title: string,
    message: string,
    data?: Record<string, any>,
  ): Promise<{ notificationId: string }> {
    this.ensureConfigured();

    const response = await this.httpService.axiosRef.post(
      `${this.baseUrl}/notifications`,
      {
        app_id: this.appId,
        included_segments: ['Subscribed Users'],
        headings: { en: title },
        contents: { en: message },
        data,
      },
      {
        headers: {
          Authorization: `Basic ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return { notificationId: response.data.id };
  }

  /**
   * Send trade alert push notification.
   */
  async sendTradeAlert(
    userId: string,
    symbol: string,
    action: string,
    price: number,
  ): Promise<void> {
    await this.sendToUsers(
      [userId],
      'Trade Alert',
      `${action.toUpperCase()} ${symbol} @ $${price.toFixed(2)}`,
      { type: 'trade_alert', symbol, action, price },
    );
  }
}
