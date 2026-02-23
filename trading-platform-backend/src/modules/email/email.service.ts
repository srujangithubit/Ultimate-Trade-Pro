import { Injectable, Logger } from '@nestjs/common';
import { IntegrationError } from '../../common/filters/http-error.filter';

let sgMail: any;
try {
  sgMail = require('@sendgrid/mail');
} catch {
  /* not installed */
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  categories?: string[];
  attachments?: Array<{
    content: string;
    filename: string;
    type: string;
    disposition?: string;
  }>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly defaultFrom: string;
  private initialized = false;

  constructor() {
    this.defaultFrom =
      process.env.SENDGRID_FROM_EMAIL || 'noreply@tradingplatform.com';
    const apiKey = process.env.SENDGRID_API_KEY;
    if (sgMail && apiKey) {
      sgMail.setApiKey(apiKey);
      this.initialized = true;
    } else {
      this.logger.warn('SendGrid not configured. Email features disabled.');
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new IntegrationError(
        'SendGrid',
        'SendGrid is not configured.',
        503,
      );
    }
  }

  async sendEmail(options: EmailOptions): Promise<{ messageId: string }> {
    this.ensureInitialized();
    const msg: any = {
      to: options.to,
      from: options.from || this.defaultFrom,
      subject: options.subject,
    };
    if (options.replyTo) msg.replyTo = options.replyTo;
    if (options.categories) msg.categories = options.categories;
    if (options.attachments) msg.attachments = options.attachments;
    if (options.templateId) {
      msg.templateId = options.templateId;
      msg.dynamicTemplateData = options.dynamicTemplateData || {};
    } else {
      msg.html = options.html;
      msg.text = options.text;
    }

    try {
      const [response] = await sgMail.send(msg);
      const messageId = response?.headers?.['x-message-id'] || '';
      this.logger.log(`Email sent to ${options.to} (${messageId})`);
      return { messageId };
    } catch (error: any) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw new IntegrationError(
        'SendGrid',
        `Email send failed: ${error.message}`,
      );
    }
  }

  async sendBulk(emails: EmailOptions[]): Promise<void> {
    this.ensureInitialized();
    const messages = emails.map((o) => ({
      to: o.to,
      from: o.from || this.defaultFrom,
      subject: o.subject,
      templateId: o.templateId,
      dynamicTemplateData: o.dynamicTemplateData,
      html: o.html,
      text: o.text,
    }));
    try {
      await sgMail.send(messages);
      this.logger.log(`Bulk email sent: ${messages.length} messages`);
    } catch (error: any) {
      throw new IntegrationError(
        'SendGrid',
        `Bulk email failed: ${error.message}`,
      );
    }
  }
}
