import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

/**
 * Analytics event tracking service (Mixpanel-compatible).
 * Also supports Amplitude via similar HTTP API.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly provider: 'mixpanel' | 'amplitude';
  private readonly token: string;
  private readonly baseUrl: string;

  constructor(private readonly httpService: HttpService) {
    this.token =
      process.env.MIXPANEL_TOKEN || process.env.AMPLITUDE_API_KEY || '';
    this.provider = process.env.AMPLITUDE_API_KEY ? 'amplitude' : 'mixpanel';

    if (this.provider === 'amplitude') {
      this.baseUrl = 'https://api2.amplitude.com/2/httpapi';
    } else {
      this.baseUrl = 'https://api.mixpanel.com';
    }

    if (this.token) {
      this.logger.log(`Analytics initialized (${this.provider})`);
    } else {
      this.logger.warn('Analytics not configured. Event tracking disabled.');
    }
  }

  /**
   * Track a user event.
   */
  async track(
    userId: string,
    event: string,
    properties: Record<string, any> = {},
  ): Promise<void> {
    if (!this.token) return;

    try {
      if (this.provider === 'mixpanel') {
        await this.trackMixpanel(userId, event, properties);
      } else {
        await this.trackAmplitude(userId, event, properties);
      }
    } catch (error: any) {
      // Analytics should never block the main flow
      this.logger.debug(`Analytics track failed: ${error.message}`);
    }
  }

  /**
   * Identify a user with profile properties.
   */
  async identify(userId: string, traits: Record<string, any>): Promise<void> {
    if (!this.token) return;

    try {
      if (this.provider === 'mixpanel') {
        await this.identifyMixpanel(userId, traits);
      } else {
        await this.identifyAmplitude(userId, traits);
      }
    } catch (error: any) {
      this.logger.debug(`Analytics identify failed: ${error.message}`);
    }
  }

  /**
   * Track predefined trading platform events.
   */
  async trackTradeImported(
    userId: string,
    broker: string,
    tradeCount: number,
  ): Promise<void> {
    await this.track(userId, 'trade_imported', { broker, tradeCount });
  }

  async trackBacktestRun(
    userId: string,
    strategyName: string,
    duration: number,
  ): Promise<void> {
    await this.track(userId, 'backtest_run', { strategyName, duration });
  }

  async trackSubscriptionEvent(
    userId: string,
    action: 'created' | 'upgraded' | 'downgraded' | 'cancelled',
    plan: string,
  ): Promise<void> {
    await this.track(userId, 'subscription_event', { action, plan });
  }

  // --- Private provider methods ---

  private async trackMixpanel(
    userId: string,
    event: string,
    properties: Record<string, any>,
  ): Promise<void> {
    const data = {
      event,
      properties: {
        token: this.token,
        distinct_id: userId,
        time: Math.floor(Date.now() / 1000),
        ...properties,
      },
    };

    const payload = Buffer.from(JSON.stringify([data])).toString('base64');
    await this.httpService.axiosRef.get(`${this.baseUrl}/track`, {
      params: { data: payload },
    });
  }

  private async trackAmplitude(
    userId: string,
    event: string,
    properties: Record<string, any>,
  ): Promise<void> {
    await this.httpService.axiosRef.post(this.baseUrl, {
      api_key: this.token,
      events: [
        {
          user_id: userId,
          event_type: event,
          event_properties: properties,
          time: Date.now(),
        },
      ],
    });
  }

  private async identifyMixpanel(
    userId: string,
    traits: Record<string, any>,
  ): Promise<void> {
    const data = {
      $token: this.token,
      $distinct_id: userId,
      $set: traits,
    };

    const payload = Buffer.from(JSON.stringify([data])).toString('base64');
    await this.httpService.axiosRef.get(`${this.baseUrl}/engage`, {
      params: { data: payload },
    });
  }

  private async identifyAmplitude(
    userId: string,
    traits: Record<string, any>,
  ): Promise<void> {
    await this.httpService.axiosRef.post(
      'https://api2.amplitude.com/identify',
      {
        api_key: this.token,
        identification: [
          {
            user_id: userId,
            user_properties: { $set: traits },
          },
        ],
      },
    );
  }
}
