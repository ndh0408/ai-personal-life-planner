import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ok } from '../../common/interceptors/response.interceptor';
import { DataPurgeService } from './data-purge.service';

const PurgeBody = z
  .object({
    confirmation: z.string().min(8).max(200),
    dryRun: z.boolean().optional(),
  })
  .strict();

/**
 * Admin-only operational endpoints. Round-18 ships only the GDPR purge
 * route; future admin actions (impersonate, force-logout-all, plan
 * upgrade) land here behind the same `JwtAuthGuard + AdminGuard` stack.
 *
 * Throttled at 5/min/IP — admin actions should be rare and deliberate;
 * exceeding the limit signals automation we don't expect.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
@Throttle({ default: { limit: 5, ttl: 60_000 } })
export class AdminController {
  constructor(private readonly purge: DataPurgeService) {}

  /**
   * POST /api/admin/users/:id/purge-data
   *
   * Body:
   *   { confirmation: "I UNDERSTAND THIS IS IRREVERSIBLE", dryRun?: true }
   *
   * Always dry-runs first in your operational playbook — the response
   * shows the exact row counts that will be deleted/anonymised. Only
   * after eyeballing the dry-run, re-issue without `dryRun: true`.
   */
  @Post('users/:id/purge-data')
  @HttpCode(200)
  async purgeUser(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe()) targetId: string,
    @Body(new ZodValidationPipe(PurgeBody)) body: z.infer<typeof PurgeBody>,
  ) {
    const result = await this.purge.purge({
      targetUserId: targetId,
      actingAdminId: admin.id,
      confirmation: body.confirmation,
      dryRun: body.dryRun,
    });
    return ok(result, body.dryRun ? 'Dry-run complete' : 'Purge complete');
  }
}
