import { Module } from '@nestjs/common';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';

/**
 * Round 20: GET / PATCH the user's PrivacySetting row, with the side effect
 * of invalidating the LifeSnapshot cache so changes take effect immediately.
 *
 * Round 26+ will add: data export, account deletion, audit trail of consent changes.
 */
@Module({
  imports: [IntelligenceModule],
  controllers: [PrivacyController],
  providers: [PrivacyService],
  exports: [PrivacyService],
})
export class PrivacyModule {}
