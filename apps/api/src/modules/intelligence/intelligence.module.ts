import { Module } from '@nestjs/common';
import { EventLogService } from './event-log.service';
import { BehaviorService } from './behavior.service';
import { AssistantMemoryService } from './assistant-memory.service';
import { UserContextService } from './user-context.service';
import { InsightGenerator } from './insight.generator';
import { CircadianService } from './circadian.service';
import { StressService } from './stress.service';
import { EnergyService } from './energy.service';
import { MemoryController } from './memory.controller';
import { TelemetryController } from './telemetry.controller';
import { PassiveIntelligenceController } from './passive-intelligence.controller';

@Module({
  imports: [],
  controllers: [MemoryController, TelemetryController, PassiveIntelligenceController],
  providers: [
    EventLogService,
    BehaviorService,
    AssistantMemoryService,
    UserContextService,
    InsightGenerator,
    CircadianService,
    StressService,
    EnergyService,
  ],
  exports: [
    EventLogService,
    BehaviorService,
    AssistantMemoryService,
    UserContextService,
    InsightGenerator,
    CircadianService,
    StressService,
    EnergyService,
  ],
})
export class IntelligenceModule {}
