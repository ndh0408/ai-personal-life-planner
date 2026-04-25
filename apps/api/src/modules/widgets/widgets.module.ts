import { Module } from '@nestjs/common';
import { WidgetsController } from './widgets.controller';
import { WidgetPreferencesService } from './widget-preferences.service';
import { WidgetSummaryService } from './widget-summary.service';

@Module({
  controllers: [WidgetsController],
  providers: [WidgetPreferencesService, WidgetSummaryService],
  exports: [WidgetPreferencesService, WidgetSummaryService],
})
export class WidgetsModule {}
