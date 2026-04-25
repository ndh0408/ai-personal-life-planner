import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { MealLogsModule } from '../meal-logs/meal-logs.module';
import { SleepLogsModule } from '../sleep-logs/sleep-logs.module';
import { MoodLogsModule } from '../mood-logs/mood-logs.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { CommunicationModule } from '../communication/communication.module';
import { VoiceCompanionController } from './voice-companion.controller';
import { SmartCheckinSettingsService } from './smart-checkin-settings.service';
import { HealthIntegrationService } from './health-integration.service';
import { QuickCaptureService } from './quick-capture.service';
import { SpeechToTextService } from './speech-to-text.service';

@Module({
  imports: [
    AiModule,
    MealLogsModule,
    SleepLogsModule,
    MoodLogsModule,
    ExpensesModule,
    CommunicationModule,
  ],
  controllers: [VoiceCompanionController],
  providers: [
    SmartCheckinSettingsService,
    HealthIntegrationService,
    QuickCaptureService,
    SpeechToTextService,
  ],
  exports: [SmartCheckinSettingsService, HealthIntegrationService, QuickCaptureService],
})
export class VoiceCompanionModule {}
