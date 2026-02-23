import { Injectable, Logger } from '@nestjs/common';
import { IntegrationError } from '../../common/filters/http-error.filter';

let Stripe: any;
try {
  Stripe = require('stripe');
} catch {
  /* not installed */
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);
  private stripe: any;

  constructor() {
    if (Stripe && process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16',
      });
    }
  }

  private ensureStripe(): void {
    if (!this.stripe)
      throw new IntegrationError('Stripe', 'Stripe is not configured.', 503);
  }

  async listInvoices(customerId: string, limit = 10): Promise<any[]> {
    this.ensureStripe();
    const { data } = await this.stripe.invoices.list({
      customer: customerId,
      limit,
    });
    return data.map((inv: any) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount: inv.amount_paid / 100,
      currency: inv.currency,
      created: new Date(inv.created * 1000),
      pdfUrl: inv.invoice_pdf,
      hostedUrl: inv.hosted_invoice_url,
      periodStart: new Date(inv.period_start * 1000),
      periodEnd: new Date(inv.period_end * 1000),
    }));
  }

  async getUpcomingInvoice(customerId: string): Promise<any> {
    this.ensureStripe();
    try {
      const inv = await this.stripe.invoices.retrieveUpcoming({
        customer: customerId,
      });
      return {
        amount: inv.amount_due / 100,
        currency: inv.currency,
        periodStart: new Date(inv.period_start * 1000),
        periodEnd: new Date(inv.period_end * 1000),
        lines: inv.lines.data.map((l: any) => ({
          description: l.description,
          amount: l.amount / 100,
          quantity: l.quantity,
        })),
      };
    } catch (e: any) {
      if (e.code === 'invoice_upcoming_none') return null;
      throw e;
    }
  }

  async getInvoice(invoiceId: string): Promise<any> {
    this.ensureStripe();
    const inv = await this.stripe.invoices.retrieve(invoiceId);
    return {
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount: inv.amount_paid / 100,
      pdfUrl: inv.invoice_pdf,
    };
  }

  async voidInvoice(invoiceId: string) {
    this.ensureStripe();
    const inv = await this.stripe.invoices.voidInvoice(invoiceId);
    return { status: inv.status };
  }
}
