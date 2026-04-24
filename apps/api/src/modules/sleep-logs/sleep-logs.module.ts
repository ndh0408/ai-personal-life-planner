import { Module } from '@nestjs/common';
import { SleepLogsController } from './sleep-logs.controller';
import { SleepLogsService } from './sleep-logs.service';

@Module({
  controllers: [SleepLogsController],
  providers: [SleepLogsService],
  exports: [SleepLogsService],
})
export class SleepLogsModule {}
