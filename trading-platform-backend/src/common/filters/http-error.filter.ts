import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Integration-specific error class for third-party API failures.
 */
export class IntegrationError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly statusCode: number = HttpStatus.BAD_GATEWAY,
    public readonly originalError?: any,
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'IntegrationError';
  }
}

/**
 * Global exception filter that maps third-party integration errors
 * to standardized HTTP responses.
 */
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let status: number;
    let message: string;
    let provider: string | undefined;

    if (exception instanceof IntegrationError) {
      status = exception.statusCode;
      message = exception.message;
      provider = exception.provider;

      this.logger.error(
        `Integration error from ${provider}: ${message}`,
        exception.originalError?.stack,
      );
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || exception.message;
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message;
      this.logger.error(`Unexpected error: ${message}`, exception.stack);
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred';
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request?.url,
      message,
      ...(provider && { provider }),
    };

    response.status(status).json(errorResponse);
  }
}
