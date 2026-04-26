import { Module } from '@nestjs/common';
import { PlannerController } from './planner.controller';
import { PlannerService } from './planner.service';
import { PlannerAiGenerator } from './planner.ai-generator';

@Module({
  controllers: [PlannerController],
  providers: [PlannerService, PlannerAiGenerator],
})
export class PlannerModule {}
