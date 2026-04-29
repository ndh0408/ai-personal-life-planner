import { Module } from '@nestjs/common';
import { PlannerController } from './planner.controller';
import { PlannerService } from './planner.service';
import { PlannerAiGenerator } from './planner.ai-generator';
import { IntelligenceModule } from '../intelligence/intelligence.module';

@Module({
  imports: [IntelligenceModule],
  controllers: [PlannerController],
  providers: [PlannerService, PlannerAiGenerator],
})
export class PlannerModule {}
