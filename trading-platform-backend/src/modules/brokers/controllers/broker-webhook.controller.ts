import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Webhook event payload from brokers.
 */
export interface BrokerWebhookEvent {
  broker: string;
  eventType: string;
  data: any;
  timestamp: Date;
  signature?: string;
}

/**
 * Controller for receiving webhook events from broker integrations.
 * Each broker can POST events to /api/webhooks/brokers/:brokerId
 */
@Controller('api/webhooks/brokers')
export class BrokerWebhookController {
  private readonly logger = new Logger(BrokerWebhookController.name);

  /**
   * Handle Alpaca webhook events (trade updates, account events).
   */
  @Post('alpaca')
  @HttpCode(HttpStatus.OK)
  async handleAlpacaWebhook(
    @Body() body: any,
    @Headers('X-Alpaca-Signature') signature: string,
  ): Promise<{ received: boolean }> {
    this.logger.log(`Received Alpaca webhook: ${body?.event}`);

    // TODO: Verify signature
    await this.processEvent({
      broker: 'alpaca',
      eventType: body?.event || 'unknown',
      data: body,
      timestamp: new Date(),
      signature,
    });

    return { received: true };
  }

  /**
   * Handle Binance webhook/stream events.
   */
  @Post('binance')
  @HttpCode(HttpStatus.OK)
  async handleBinanceWebhook(
    @Body() body: any,
  ): Promise<{ received: boolean }> {
    this.logger.log(`Received Binance webhook: ${body?.e}`);

    await this.processEvent({
      broker: 'binance',
      eventType: body?.e || 'unknown',
      data: body,
      timestamp: new Date(body?.E || Date.now()),
    });

    return { received: true };
  }

  /**
   * Handle Coinbase webhook events.
   */
  @Post('coinbase')
  @HttpCode(HttpStatus.OK)
  async handleCoinbaseWebhook(
    @Body() body: any,
    @Headers('CB-SIGNATURE') signature: string,
  ): Promise<{ received: boolean }> {
    this.logger.log(`Received Coinbase webhook: ${body?.type}`);

    await this.processEvent({
      broker: 'coinbase',
      eventType: body?.type || 'unknown',
      data: body,
      timestamp: new Date(),
      signature,
    });

    return { received: true };
  }

  /**
   * Generic webhook handler for any broker.
   */
  @Post(':brokerId')
  @HttpCode(HttpStatus.OK)
  async handleGenericWebhook(
    @Param('brokerId') brokerId: string,
    @Body() body: any,
  ): Promise<{ received: boolean }> {
    this.logger.log(`Received webhook from ${brokerId}`);

    await this.processEvent({
      broker: brokerId,
      eventType: body?.type || body?.event || 'unknown',
      data: body,
      timestamp: new Date(),
    });

    return { received: true };
  }

  /**
   * Process a broker webhook event internally.
   * In production, this would dispatch to appropriate services
   * (e.g., trade sync, notification service, etc.).
   */
  private async processEvent(event: BrokerWebhookEvent): Promise<void> {
    this.logger.log(`Processing ${event.broker} event: ${event.eventType}`);

    switch (event.eventType) {
      case 'trade_update':
      case 'executionReport':
      case 'fill':
        // Handle trade execution events
        this.logger.log(
          `Trade event from ${event.broker}: ${JSON.stringify(event.data)}`,
        );
        break;

      case 'account_update':
      case 'outboundAccountPosition':
        // Handle account balance changes
        this.logger.log(`Account update from ${event.broker}`);
        break;

      default:
        this.logger.debug(`Unhandled event type: ${event.eventType}`);
    }
  }
}
