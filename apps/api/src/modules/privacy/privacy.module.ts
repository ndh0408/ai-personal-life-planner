import { Module } from '@nestjs/common';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { PrivacyTierController } from './privacy-tier.controller';
import { PrivacyTierService } from './privacy-tier.service';

@Module({
  imports: [IntelligenceModule],
  controllers: [PrivacyController, PrivacyTierController],
  providers: [PrivacyService, PrivacyTierService],
  exports: [PrivacyService, PrivacyTierService],
})
export class PrivacyModule {}
