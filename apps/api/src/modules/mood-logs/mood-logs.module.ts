import { Module } from '@nestjs/common';
import { MoodLogsController } from './mood-logs.controller';
import { MoodLogsService } from './mood-logs.service';

@Module({
  controllers: [MoodLogsController],
  providers: [MoodLogsService],
  exports: [MoodLogsService],
})
export class MoodLogsModule {}
