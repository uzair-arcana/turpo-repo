import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-ioredis';
import { ENV } from '../util/env';

@Global()
@Module({
  imports: [
    CacheModule.register({
      store: redisStore,
      host: ENV.REDIS_HOST,
      port: ENV.REDIS_PORT,
      password: ENV.REDIS_PASSWORD,
      db: 0,
      ttl: 0, // Default TTL (0 = no expiration), can be overridden per key
    }),
  ],
  exports: [CacheModule],
})
export class RedisModule {}
