import { Logger } from '@nestjs/common';

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelay?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;
  /** Whether to add jitter to prevent thundering herd (default: true) */
  jitter?: boolean;
  /** HTTP status codes that should trigger a retry (default: [429, 500, 502, 503, 504]) */
  retryableStatuses?: number[];
  /** Optional logger instance */
  logger?: Logger;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'logger'>> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  jitter: true,
  retryableStatuses: [429, 500, 502, 503, 504],
};

/**
 * Execute a function with exponential backoff retry logic.
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const logger = opts.logger || new Logger('RetryUtil');
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      const statusCode = error?.response?.status || error?.status;
      const isRetryable =
        !statusCode || opts.retryableStatuses.includes(statusCode);

      if (attempt >= opts.maxRetries || !isRetryable) {
        throw error;
      }

      // Check for Retry-After header
      const retryAfterHeader =
        error?.response?.headers?.['retry-after'] ||
        error?.response?.headers?.['x-ratelimit-reset'];
      let delay: number;

      if (retryAfterHeader) {
        const retryAfterSeconds = parseInt(retryAfterHeader, 10);
        delay = isNaN(retryAfterSeconds)
          ? opts.baseDelay * Math.pow(2, attempt)
          : retryAfterSeconds * 1000;
      } else {
        delay = opts.baseDelay * Math.pow(2, attempt);
      }

      // Add jitter
      if (opts.jitter) {
        delay = delay * (0.5 + Math.random() * 0.5);
      }

      // Cap at max delay
      delay = Math.min(delay, opts.maxDelay);

      logger.warn(
        `Attempt ${attempt + 1}/${opts.maxRetries} failed` +
          `${statusCode ? ` (HTTP ${statusCode})` : ''}, retrying in ${Math.round(delay)}ms...`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Decorator-style retry wrapper for class methods.
 */
export function Retryable(options: RetryOptions = {}) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return withRetry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}
