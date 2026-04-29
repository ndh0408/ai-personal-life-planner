import { Module } from '@nestjs/common';
import { EventLogService } from './event-log.service';
import { BehaviorService } from './behavior.service';
import { AssistantMemoryService } from './assistant-memory.service';
import { UserContextService } from './user-context.service';
import { InsightGenerator } from './insight.generator';
import { MemoryController } from './memory.controller';

@Module({
  imports: [],
  controllers: [MemoryController],
  providers: [
    EventLogService,
    BehaviorService,
    AssistantMemoryService,
    UserContextService,
    InsightGenerator,
  ],
  exports: [
    EventLogService,
    BehaviorService,
    AssistantMemoryService,
    UserContextService,
    InsightGenerator,
  ],
})
export class IntelligenceModule {}
