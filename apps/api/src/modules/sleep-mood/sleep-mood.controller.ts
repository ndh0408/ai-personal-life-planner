import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { SleepMoodService } from './sleep-mood.service';

@ApiBearerAuth()
@ApiTags('sleep-mood')
@Controller()
export class SleepMoodController {
  constructor(private readonly svc: SleepMoodService) {}

  @Get('sleep/latest')
  sleep(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.latestSleep(user.id);
  }

  @Get('mood/latest')
  mood(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.latestMood(user.id);
  }
}
