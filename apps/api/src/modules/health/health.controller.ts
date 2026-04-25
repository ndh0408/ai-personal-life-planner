import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../queue/redis.service';
import { QueueService } from '../queue/queue.service';

/**
 * Liveness vs readiness:
 *  - GET /health        → liveness; cheap process ping (no I/O)
 *  - GET /health/ready  → readiness; pings DB + Redis (when enabled) +
 *    snapshots queue depth so a bad dependency takes the pod out of
 *    rotation rather than failing requests halfway through.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly queue: QueueService,
  ) {}

  @Get()
  ping() {
    return {
      status: 'ok',
      service: 'planner-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready() {
    const dbOk = await this.prisma
      .$queryRaw`SELECT 1`.then(() => true)
      .catch(() => false);
    const redisEnabled = this.redis.isEnabled();
    const redisOk = redisEnabled ? await this.redis.ping() : null;
    let queues: Record<string, { waiting: number; active: number; failed: number }> | null = null;
    if (redisEnabled && redisOk) {
      queues = await this.queue.getCounts().catch(() => null);
    }
    const allOk = dbOk && (redisEnabled ? redisOk === true : true);
    return {
      status: allOk ? 'ready' : 'degraded',
      database: dbOk ? 'up' : 'down',
      redis: redisEnabled ? (redisOk ? 'up' : 'down') : 'disabled',
      queues,
    };
  }
}
