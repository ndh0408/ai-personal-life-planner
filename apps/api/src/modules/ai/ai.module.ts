import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AI_PROVIDER_TOKEN, buildAiProvider } from './providers/ai-provider.factory';
import { AiProviderService } from './services/ai-provider.service';
import { AiPromptTemplateService } from './services/ai-prompt-template.service';
import { AiJsonValidationService } from './services/ai-json-validation.service';
import { PreviewCacheService } from './services/preview-cache.service';
import { AiPlannerService } from './services/ai-planner.service';
import { AiMealService } from './services/ai-meal.service';
import { AiChatService } from './services/ai-chat.service';
import { AiInsightService } from './services/ai-insight.service';

@Module({
  controllers: [AiController],
  providers: [
    {
      provide: AI_PROVIDER_TOKEN,
      useFactory: (config: ConfigService) => buildAiProvider(config),
      inject: [ConfigService],
    },
    AiProviderService,
    AiPromptTemplateService,
    AiJsonValidationService,
    PreviewCacheService,
    AiPlannerService,
    AiMealService,
    AiChatService,
    AiInsightService,
  ],
  exports: [
    AI_PROVIDER_TOKEN,
    AiProviderService,
    AiPromptTemplateService,
    AiJsonValidationService,
    AiPlannerService,
    AiMealService,
    AiChatService,
    AiInsightService,
  ],
})
export class AiModule {}
