import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsWebhookController } from './payments-webhook.controller';
import { InvoiceService } from './invoice.service';

@Module({
  controllers: [PaymentsWebhookController],
  providers: [PaymentsService, InvoiceService],
  exports: [PaymentsService, InvoiceService],
})
export class PaymentsModule {}
