import { Module } from '@nestjs/common';
import { ContextInferenceController } from './context-inference.controller';
import { ContextSignalService } from './context-signal.service';
import { InferenceRuleService } from './inference-rule.service';
import { UserPatternService } from './user-pattern.service';
import { RecommendationTriggerService } from './recommendation-trigger.service';

@Module({
  controllers: [ContextInferenceController],
  providers: [
    ContextSignalService,
    InferenceRuleService,
    UserPatternService,
    RecommendationTriggerService,
  ],
  exports: [RecommendationTriggerService, UserPatternService],
})
export class ContextInferenceModule {}
