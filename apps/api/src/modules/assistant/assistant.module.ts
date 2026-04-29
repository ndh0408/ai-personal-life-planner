import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AssistantStreamingService } from './assistant.streaming.service';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { IntelligenceModule } from '../intelligence/intelligence.module';

@Module({
  imports: [IntelligenceModule],
  controllers: [AssistantController, RecommendationsController],
  providers: [AssistantService, AssistantStreamingService, RecommendationsService],
})
export class AssistantModule {}
