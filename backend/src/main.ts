import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import { getCorsOrigins } from './common/cors.util';
import {
  apiRequestLatencySeconds,
  apiRequestsTotal,
  metricsRegistry,
} from './observability/metrics';
import { initializeTracing, shutdownTracing } from './observability/tracing';

function requireEnv(name: string): void {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

async function bootstrap() {
  requireEnv('JWT_SECRET');
  requireEnv('JWT_REFRESH_SECRET');
  await initializeTracing();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
  });
  // Increase body size limit for chart screenshot uploads (base64)
  app.useBodyParser('json', { limit: '20mb' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: getCorsOrigins(),
    credentials: true,
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const durationSeconds =
        Number(process.hrtime.bigint() - started) / 1_000_000_000;
      const route = req.route?.path || req.path || 'unknown';
      const labels = {
        method: req.method,
        route,
        status_code: String(res.statusCode),
      };
      apiRequestsTotal.inc(labels);
      apiRequestLatencySeconds.observe(labels, durationSeconds);
    });
    next();
  });

  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.get('/metrics', async (_req: Request, res: Response) => {
    res.setHeader('Content-Type', metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  });

  // Serve uploaded community images as static files
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });
  const config = new DocumentBuilder()
    .setTitle('Trading Platform API')
    .setDescription('The trading platform API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  process.on('SIGTERM', () => {
    void shutdownTracing();
  });
  process.on('SIGINT', () => {
    void shutdownTracing();
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
