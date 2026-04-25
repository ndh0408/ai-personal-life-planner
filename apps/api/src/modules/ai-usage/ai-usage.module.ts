import { Global, Module } from '@nestjs/common';
import { AiUsageService } from './ai-usage.service';
import { AiUsageController } from './ai-usage.controller';

/**
 * Global so any AI-calling service can `constructor(private usage:
 * AiUsageService)` without depth-importing.
 */
@Global()
@Module({
  controllers: [AiUsageController],
  providers: [AiUsageService],
  exports: [AiUsageService],
})
export class AiUsageModule {}
