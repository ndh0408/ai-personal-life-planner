import { Module } from '@nestjs/common';
import { SleepMoodController } from './sleep-mood.controller';
import { SleepMoodService } from './sleep-mood.service';

@Module({
  controllers: [SleepMoodController],
  providers: [SleepMoodService],
})
export class SleepMoodModule {}
