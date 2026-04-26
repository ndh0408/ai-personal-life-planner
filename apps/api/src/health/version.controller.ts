import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('meta')
@Controller('version')
export class VersionController {
  private static readonly VERSION = '0.1.0';
  private static readonly STARTED_AT = new Date().toISOString();

  @Public()
  @Get()
  version() {
    return {
      service: 'lifeos-api',
      version: VersionController.VERSION,
      startedAt: VersionController.STARTED_AT,
      node: process.version,
      env: process.env.NODE_ENV ?? 'development',
    };
  }
}
