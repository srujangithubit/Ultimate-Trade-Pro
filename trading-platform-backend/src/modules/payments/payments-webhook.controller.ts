import {
  Controller,
  Post,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';

let Stripe: any;
try {
  Stripe = require('stripe');
} catch {
  /* not installed */
}

@Controller('api/webhooks/stripe')
export class PaymentsWebhookController {
  private readonly logger = new Logger(PaymentsWebhookController.name);
  private stripe: any;

  constructor() {
    if (Stripe && process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16',
      });
    }
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() request: any,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    if (!this.stripe) return { received: false };

    let event: any;
    try {
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      event =
        secret && request.rawBody
          ? this.stripe.webhooks.constructEvent(
              request.rawBody,
              signature,
              secret,
            )
          : request.body;
    } catch (err: any) {
      this.logger.error(
        'Webhook signature verification failed: ' + err.message,
      );
      return { received: false };
    }

    this.logger.log('Stripe event: ' + event.type);
    await this.routeEvent(event);
    return { received: true };
  }

  private async routeEvent(event: any): Promise<void> {
    switch (event.type) {
      case 'invoice.payment_succeeded':
        this.logger.log(
          'Payment succeeded: customer ' + event.data.object.customer,
        );
        break;
      case 'invoice.payment_failed':
        this.logger.warn(
          'Payment failed: customer ' + event.data.object.customer,
        );
        break;
      case 'customer.subscription.created':
        this.logger.log('Subscription created: ' + event.data.object.id);
        break;
      case 'customer.subscription.updated':
        this.logger.log('Subscription updated: ' + event.data.object.id);
        break;
      case 'customer.subscription.deleted':
        this.logger.log('Subscription canceled: ' + event.data.object.id);
        break;
      case 'customer.subscription.trial_will_end':
        this.logger.log('Trial ending: ' + event.data.object.id);
        break;
      default:
        this.logger.debug('Unhandled event: ' + event.type);
    }
  }
}
