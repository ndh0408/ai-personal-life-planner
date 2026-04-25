import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminGuard } from '../../common/guards/admin.guard';
import { DataPurgeService } from './data-purge.service';

/**
 * Round 18 — admin-only operational endpoints (GDPR purge today; more
 * later). The auth/finance/security audit dependencies are pulled in
 * automatically via the @Global modules from rounds 13-17.
 */
@Module({
  controllers: [AdminController],
  providers: [DataPurgeService, AdminGuard],
})
export class AdminModule {}
