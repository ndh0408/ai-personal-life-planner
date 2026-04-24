import { Module } from '@nestjs/common';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

/**
 * Personal goals foundation module.
 *
 * Scope for this iteration is *foundation only* — routes are wired but return
 * placeholder payloads. Full functionality (goal creation, milestones,
 * progress tracking, AI-suggested daily actions, stalled-goal detection) will
 * land with a dedicated Prisma sub-schema in a follow-up iteration.
 */
@Module({
  controllers: [GoalsController],
  providers: [GoalsService],
  exports: [GoalsService],
})
export class GoalsModule {}
