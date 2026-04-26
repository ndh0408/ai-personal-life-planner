import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
  controllers: [AssistantController, RecommendationsController],
  providers: [AssistantService, RecommendationsService],
})
export class AssistantModule {}
