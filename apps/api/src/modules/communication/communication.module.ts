import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CommunicationController } from './communication.controller';
import { CommunicationSettingsService } from './communication-settings.service';
import { ConnectedAccountsService } from './connected-accounts.service';
import { EmailService } from './email.service';
import { RemindersService } from './reminders.service';
import { CompanionMemoryService } from './companion-memory.service';
import { AiCommunicationService } from './ai-communication.service';

@Module({
  imports: [AiModule],
  controllers: [CommunicationController],
  providers: [
    CommunicationSettingsService,
    ConnectedAccountsService,
    EmailService,
    RemindersService,
    CompanionMemoryService,
    AiCommunicationService,
  ],
  exports: [
    CommunicationSettingsService,
    CompanionMemoryService,
  ],
})
export class CommunicationModule {}
