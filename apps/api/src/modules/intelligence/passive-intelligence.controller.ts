/**
 * Public read endpoint for the round-38 passive intelligence services
 * (Circadian, Stress, Energy). The mobile app uses these to render the
 * "Đỉnh tập trung", "Stress hôm nay" and "Năng lượng" cards on the
 * Insights screen + DevPanel.
 *
 * No mutations — these are pure derivations from data the user already
 * generated. Privacy: the underlying services read EventLog, SleepLog,
 * MoodLog, HeartRateSample, Task — all already gated by privacy flags
 * upstream when the data lands.
 */
import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { CircadianService } from './circadian.service';
import { StressService } from './stress.service';
import { EnergyService } from './energy.service';

@ApiBearerAuth()
@ApiTags('passive-intelligence')
@Controller('intelligence')
export class PassiveIntelligenceController {
  constructor(
    private readonly circadian: CircadianService,
    private readonly stress: StressService,
    private readonly energy: EnergyService,
  ) {}

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('circadian')
  circadianForUser(@CurrentUser() user: AuthenticatedUser) {
    return this.circadian.getForUser(user.id);
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('stress')
  stressForUser(@CurrentUser() user: AuthenticatedUser) {
    return this.stress.assess(user.id);
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('energy')
  energyForUser(@CurrentUser() user: AuthenticatedUser) {
    return this.energy.assess(user.id);
  }

  /** Combined fetch — saves three round-trips when the UI wants all three. */
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('snapshot')
  async combined(@CurrentUser() user: AuthenticatedUser) {
    const [circadian, stress, energy] = await Promise.all([
      this.circadian.getForUser(user.id),
      this.stress.assess(user.id),
      this.energy.assess(user.id),
    ]);
    return { circadian, stress, energy };
  }
}
