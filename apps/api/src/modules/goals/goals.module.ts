import { Module } from '@nestjs/common';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';
import { GoalMilestonesController } from './goal-milestones.controller';
import { GoalMilestonesService } from './goal-milestones.service';

@Module({
  controllers: [GoalsController, GoalMilestonesController],
  providers: [GoalsService, GoalMilestonesService],
  exports: [GoalsService, GoalMilestonesService],
})
export class GoalsModule {}
