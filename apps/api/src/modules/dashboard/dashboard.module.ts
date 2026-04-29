import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { SmartBriefService } from './smart-brief.service';
import { IntelligenceModule } from '../intelligence/intelligence.module';

@Module({
  imports: [IntelligenceModule],
  controllers: [DashboardController],
  providers: [DashboardService, SmartBriefService],
})
export class DashboardModule {}
