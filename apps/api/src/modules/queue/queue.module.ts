import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { QueueService } from './queue.service';

/**
 * Global so every feature module can `constructor(private q: QueueService)`
 * without re-importing. Two providers only — Redis client + typed Queue
 * wrapper. Workers live in their own modules so they can be skipped with a
 * separate boot flag (worker-only deployments later).
 */
@Global()
@Module({
  providers: [RedisService, QueueService],
  exports: [RedisService, QueueService],
})
export class QueueModule {}
