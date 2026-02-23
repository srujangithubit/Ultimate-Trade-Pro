import { Injectable, Logger } from '@nestjs/common';
import { IntegrationError } from '../../common/filters/http-error.filter';

let twilio: any;
try {
  twilio = require('twilio');
} catch {
  // Twilio not installed
}

/**
 * Twilio SMS notification service for 2FA and trade alerts.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private client: any;
  private readonly fromNumber: string;

  constructor() {
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (twilio && accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
      this.logger.log('Twilio SMS initialized');
    } else {
      this.logger.warn('Twilio not configured. SMS features disabled.');
    }
  }

  private ensureClient(): void {
    if (!this.client) {
      throw new IntegrationError('Twilio', 'SMS service not configured.', 503);
    }
  }

  /**
   * Send an SMS message.
   */
  async sendSms(
    to: string,
    body: string,
  ): Promise<{ messageId: string; status: string }> {
    this.ensureClient();

    try {
      const message = await this.client.messages.create({
        to,
        from: this.fromNumber,
        body,
      });

      this.logger.log(`SMS sent to ${to}: ${message.sid}`);
      return {
        messageId: message.sid,
        status: message.status,
      };
    } catch (error: any) {
      this.logger.error(`SMS to ${to} failed: ${error.message}`);
      throw new IntegrationError('Twilio', `SMS failed: ${error.message}`);
    }
  }

  /**
   * Send a 2FA verification code.
   */
  async sendVerificationCode(to: string, code: string): Promise<void> {
    await this.sendSms(
      to,
      `Your Trading Platform verification code is: ${code}. This code expires in 5 minutes.`,
    );
  }

  /**
   * Send a trade alert notification.
   */
  async sendTradeAlert(
    to: string,
    symbol: string,
    action: string,
    price: number,
  ): Promise<void> {
    await this.sendSms(
      to,
      `Trade Alert: ${action.toUpperCase()} ${symbol} @ $${price.toFixed(2)}`,
    );
  }
}
