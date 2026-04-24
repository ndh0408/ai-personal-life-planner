import { Module } from '@nestjs/common';
import { ScheduleItemsController, NestedScheduleItemsController } from './schedule-items.controller';
import { ScheduleItemsService } from './schedule-items.service';

@Module({
  controllers: [ScheduleItemsController, NestedScheduleItemsController],
  providers: [ScheduleItemsService],
  exports: [ScheduleItemsService],
})
export class ScheduleItemsModule {}
