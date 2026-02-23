import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import * as Bull from 'bull';
import { EmailService } from './email.service';
import { EmailOptions } from './email.service';
import { buildTemplateData } from './email-templates';

export interface EmailJobData {
  options?: EmailOptions;
  templateKey?: string;
  to?: string;
  customData?: Record<string, any>;
}

@Processor('email')
export class EmailQueueProcessor {
  private readonly logger = new Logger(EmailQueueProcessor.name);

  constructor(private readonly emailService: EmailService) {}

  @Process('send')
  async handleSend(job: Bull.Job<EmailJobData>): Promise<void> {
    const { options, templateKey, to, customData } = job.data;
    try {
      if (options) {
        await this.emailService.sendEmail(options);
      } else if (templateKey && to) {
        const result = buildTemplateData(templateKey, customData || {});
        await this.emailService.sendEmail({
          to,
          subject: '',
          templateId: result.templateId,
          dynamicTemplateData: result.data,
        });
      }
      this.logger.log('Email job ' + job.id + ' completed');
    } catch (error: any) {
      this.logger.error('Email job ' + job.id + ' failed: ' + error.message);
      throw error;
    }
  }

  @Process('bulk')
  async handleBulk(job: Bull.Job<{ emails: EmailOptions[] }>): Promise<void> {
    try {
      await this.emailService.sendBulk(job.data.emails);
      this.logger.log(
        'Bulk email job ' +
          job.id +
          ' completed: ' +
          job.data.emails.length +
          ' emails',
      );
    } catch (error: any) {
      this.logger.error(
        'Bulk email job ' + job.id + ' failed: ' + error.message,
      );
      throw error;
    }
  }
}
