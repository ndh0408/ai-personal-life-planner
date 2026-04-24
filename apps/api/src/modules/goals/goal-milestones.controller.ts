import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ok } from '../../common/interceptors/response.interceptor';
import { GoalMilestonesService } from './goal-milestones.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DateStr = z.string().regex(DATE_RE, 'Must be YYYY-MM-DD');
const StatusSchema = z.enum(['TODO', 'COMPLETED', 'CANCELLED']);

const CreateSchema = z
  .object({
    title: z.string().min(1).max(200),
    targetDate: DateStr.optional(),
  })
  .strict();

const UpdateSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    targetDate: DateStr.nullable().optional(),
    status: StatusSchema.optional(),
  })
  .strict();

const PatchStatusSchema = z.object({ status: StatusSchema }).strict();

/**
 * Two controllers share the same service:
 *   POST /api/goals/:id/milestones         — create (context = goal)
 *   PUT/PATCH/DELETE /api/goal-milestones/:id — operate by milestone id
 *
 * Keep the "goal-milestones" top-level routes so mobile doesn't need to thread
 * the parent goal id through PUT/PATCH/DELETE.
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class GoalMilestonesController {
  constructor(private readonly svc: GoalMilestonesService) {}

  @Post('goals/:goalId/milestones')
  async create(
    @CurrentUser() user: AuthUser,
    @Param('goalId', new ParseUUIDPipe()) goalId: string,
    @Body(new ZodValidationPipe(CreateSchema)) body: z.infer<typeof CreateSchema>,
  ) {
    return ok(await this.svc.create(user.id, goalId, body), 'Milestone created');
  }

  @Put('goal-milestones/:id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateSchema)) body: z.infer<typeof UpdateSchema>,
  ) {
    const input = { ...body, targetDate: body.targetDate ?? undefined };
    return ok(await this.svc.update(user.id, id, input), 'Milestone updated');
  }

  @Patch('goal-milestones/:id/status')
  async patchStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(PatchStatusSchema)) body: z.infer<typeof PatchStatusSchema>,
  ) {
    return ok(await this.svc.patchStatus(user.id, id, body.status), 'Milestone status updated');
  }

  @Delete('goal-milestones/:id')
  async delete(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.svc.delete(user.id, id);
    return ok(null, 'Milestone deleted');
  }
}
