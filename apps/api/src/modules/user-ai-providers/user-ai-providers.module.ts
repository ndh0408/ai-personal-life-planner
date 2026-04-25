import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { UserAiProvidersController } from './user-ai-providers.controller';
import { UserAiProviderService } from './user-ai-provider.service';
import { UserAiPreferenceService } from './user-ai-preference.service';

@Module({
  imports: [AiModule],
  controllers: [UserAiProvidersController],
  providers: [UserAiProviderService, UserAiPreferenceService],
  exports: [UserAiProviderService, UserAiPreferenceService],
})
export class UserAiProvidersModule {}
