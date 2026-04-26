import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    let db: 'ok' | 'down' = 'down';
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      db = 'ok';
    } catch {
      db = 'down';
    }
    return {
      status: 'ok',
      service: 'lifeos-api',
      version: '0.1.0',
      db,
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
