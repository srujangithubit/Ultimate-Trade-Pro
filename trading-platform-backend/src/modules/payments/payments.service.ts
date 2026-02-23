import { Injectable, Logger } from '@nestjs/common';
import { IntegrationError } from '../../common/filters/http-error.filter';

// Dynamic import to avoid hard compile-time dependency
let Stripe: any;
try {
  Stripe = require('stripe');
} catch {
  // stripe package not installed — runtime error if used
}

export interface CreateSubscriptionDto {
  userId: string;
  email: string;
  priceId: string;
  paymentMethodId?: string;
  trialDays?: number;
}

export interface SubscriptionResult {
  subscriptionId: string;
  status: string;
  clientSecret?: string;
  currentPeriodEnd: Date;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: any;
  private readonly customerMap = new Map<string, string>();

  constructor() {
    if (!Stripe) {
      this.logger.warn(
        'Stripe package not installed. Payment features disabled.',
      );
      return;
    }
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (secretKey) {
      this.stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set. Payment features disabled.');
    }
  }

  private ensureStripe(): void {
    if (!this.stripe) {
      throw new IntegrationError('Stripe', 'Stripe is not configured.', 503);
    }
  }

  async getOrCreateCustomer(
    userId: string,
    email: string,
    name?: string,
  ): Promise<string> {
    this.ensureStripe();
    const existing = this.customerMap.get(userId);
    if (existing) return existing;

    const search = await this.stripe.customers.search({
      query: `metadata["userId"]:"${userId}"`,
    });
    if (search.data.length > 0) {
      this.customerMap.set(userId, search.data[0].id);
      return search.data[0].id;
    }

    const customer = await this.stripe.customers.create({
      email,
      name,
      metadata: { userId },
    });
    this.customerMap.set(userId, customer.id);
    return customer.id;
  }

  async createSubscription(
    dto: CreateSubscriptionDto,
  ): Promise<SubscriptionResult> {
    this.ensureStripe();
    const customerId = await this.getOrCreateCustomer(dto.userId, dto.email);

    if (dto.paymentMethodId) {
      await this.stripe.paymentMethods.attach(dto.paymentMethodId, {
        customer: customerId,
      });
      await this.stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: dto.paymentMethodId },
      });
    }

    const params: any = {
      customer: customerId,
      items: [{ price: dto.priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    };
    if (dto.trialDays) params.trial_period_days = dto.trialDays;

    const subscription = await this.stripe.subscriptions.create(params);
    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      clientSecret: subscription.latest_invoice?.payment_intent?.client_secret,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    };
  }

  async cancelSubscription(subscriptionId: string, immediately = false) {
    this.ensureStripe();
    if (immediately) {
      const sub = await this.stripe.subscriptions.cancel(subscriptionId);
      return { status: sub.status };
    }
    const sub = await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
    return {
      status: sub.status,
      cancelAt: new Date(sub.current_period_end * 1000),
    };
  }

  async resumeSubscription(subscriptionId: string) {
    this.ensureStripe();
    const sub = await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
    return { status: sub.status };
  }

  async changeSubscriptionPlan(
    subscriptionId: string,
    newPriceId: string,
  ): Promise<SubscriptionResult> {
    this.ensureStripe();
    const sub = await this.stripe.subscriptions.retrieve(subscriptionId);
    const updated = await this.stripe.subscriptions.update(subscriptionId, {
      items: [{ id: sub.items.data[0].id, price: newPriceId }],
      proration_behavior: 'create_prorations',
    });
    return {
      subscriptionId: updated.id,
      status: updated.status,
      currentPeriodEnd: new Date(updated.current_period_end * 1000),
    };
  }

  async getSubscription(subscriptionId: string) {
    this.ensureStripe();
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }

  async createPortalSession(customerId: string, returnUrl: string) {
    this.ensureStripe();
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }

  async createSetupIntent(customerId: string) {
    this.ensureStripe();
    const intent = await this.stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });
    return { clientSecret: intent.client_secret };
  }
}
