import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { StorageService } from './storage.service';
import { SmsService } from './sms.service';
import { PushNotificationService } from './push-notification.service';
import { ErrorTrackingService } from './error-tracking.service';
import { AnalyticsService } from './analytics.service';

/**
 * Auxiliary Integrations Module.
 * S3 storage, Twilio SMS, OneSignal push, Sentry error tracking, analytics.
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
    }),
  ],
  providers: [
    StorageService,
    SmsService,
    PushNotificationService,
    ErrorTrackingService,
    AnalyticsService,
  ],
  exports: [
    StorageService,
    SmsService,
    PushNotificationService,
    ErrorTrackingService,
    AnalyticsService,
  ],
})
export class IntegrationsModule {}
