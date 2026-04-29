/**
 * Liveness / readiness / deep healthchecks (round 28).
 *
 * The split follows the standard orchestrator pattern:
 *
 *   GET /health        — liveness. The process answered, period. Doesn't
 *                        check DB/Redis so a transient blip doesn't
 *                        trigger a container restart loop.
 *   GET /health/ready  — readiness. DB + Redis must be healthy.
 *                        Orchestrators gate traffic on this.
 *   GET /health/deep   — full diagnostic for ops + the mobile DevPanel:
 *                        all of /health/ready plus encryption-key check,
 *                        snapshot version, uptime, and the API version.
 *
 * Liveness intentionally returns 200 with no body checks. A failing
 * liveness causes a kill+restart, which only helps when the process is
 * stuck — not when Postgres is recovering.
 */
import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { Public } from '../common/decorators/public.decorator';
import { SNAPSHOT_VERSION } from '../modules/intelligence/user-context.service';

interface HealthShape {
  service: 'lifeos-api';
  status: 'ok' | 'degraded' | 'down';
  version: string;
  uptimeSec: number;
  timestamp: string;
  db?: 'ok' | 'down';
  redis?: 'ok' | 'down';
  snapshotVersion?: string;
  encryptionKeyConfigured?: boolean;
}

@ApiTags('meta')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  /** Liveness: the process is up. No dependency checks. */
  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  liveness(): HealthShape {
    return {
      service: 'lifeos-api',
      status: 'ok',
      version: this.config.get<string>('APP_VERSION') ?? '0.28.0',
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness: DB + Redis must answer. Orchestrators gate traffic on this. */
  @Public()
  @Get('ready')
  async readiness(): Promise<HealthShape> {
    const [db, redis] = await Promise.all([this.checkDb(), this.redis.ping()]);
    const status: HealthShape['status'] = db === 'ok' && redis === 'ok' ? 'ok' : 'degraded';
    return {
      service: 'lifeos-api',
      status,
      version: this.config.get<string>('APP_VERSION') ?? '0.28.0',
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      db,
      redis,
    };
  }

  /** Deep healthcheck: everything readiness checks plus encryption + snapshot. */
  @Public()
  @Get('deep')
  async deep(): Promise<HealthShape> {
    const [db, redis] = await Promise.all([this.checkDb(), this.redis.ping()]);
    const encryptionKeyConfigured =
      typeof this.config.get<string>('USER_AI_KEY_ENCRYPTION_KEY') === 'string';
    const status: HealthShape['status'] =
      db === 'ok' && redis === 'ok' && encryptionKeyConfigured ? 'ok' : 'degraded';
    return {
      service: 'lifeos-api',
      status,
      version: this.config.get<string>('APP_VERSION') ?? '0.28.0',
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      db,
      redis,
      snapshotVersion: SNAPSHOT_VERSION,
      encryptionKeyConfigured,
    };
  }

  private async checkDb(): Promise<'ok' | 'down'> {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return 'ok';
    } catch {
      return 'down';
    }
  }
}
