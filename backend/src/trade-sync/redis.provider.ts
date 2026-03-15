import { Provider } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';
export const REDIS_SUBSCRIBER = 'REDIS_SUBSCRIBER';

function createRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    return new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
  }

  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });
}

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: () => createRedisClient(),
};

export const redisSubscriberProvider: Provider = {
  provide: REDIS_SUBSCRIBER,
  useFactory: () => createRedisClient(),
};
