import { Injectable, Logger } from '@nestjs/common';

let Sentry: any;
try {
  Sentry = require('@sentry/node');
} catch {
  // Sentry not installed
}

/**
 * Sentry error tracking integration.
 * Initializes Sentry SDK and provides methods for exception capture.
 */
@Injectable()
export class ErrorTrackingService {
  private readonly logger = new Logger(ErrorTrackingService.name);
  private initialized = false;

  constructor() {
    const dsn = process.env.SENTRY_DSN;

    if (Sentry && dsn) {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'development',
        release: process.env.APP_VERSION || '1.0.0',
        tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_RATE || '0.1'),
        integrations: [],
      });
      this.initialized = true;
      this.logger.log('Sentry error tracking initialized');
    } else {
      this.logger.warn('Sentry not configured. Error tracking disabled.');
    }
  }

  /**
   * Capture an exception.
   */
  captureException(error: Error, context?: Record<string, any>): void {
    if (!this.initialized) {
      this.logger.error(`Uncaptured exception: ${error.message}`, error.stack);
      return;
    }

    if (context) {
      Sentry.withScope((scope: any) => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  }

  /**
   * Capture a message (non-error event).
   */
  captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
  ): void {
    if (!this.initialized) {
      this.logger.log(`Uncaptured message [${level}]: ${message}`);
      return;
    }
    Sentry.captureMessage(message, level);
  }

  /**
   * Set user context for error reports.
   */
  setUser(user: { id: string; email?: string; username?: string }): void {
    if (!this.initialized) return;
    Sentry.setUser(user);
  }

  /**
   * Clear user context.
   */
  clearUser(): void {
    if (!this.initialized) return;
    Sentry.setUser(null);
  }

  /**
   * Add breadcrumb for debugging.
   */
  addBreadcrumb(
    category: string,
    message: string,
    data?: Record<string, any>,
  ): void {
    if (!this.initialized) return;
    Sentry.addBreadcrumb({ category, message, data, level: 'info' });
  }
}
