import { Module } from '@nestjs/common';
import { MealLogsController, MealsController } from './meals.controller';
import { MealsService } from './meals.service';

@Module({
  controllers: [MealsController, MealLogsController],
  providers: [MealsService],
})
export class MealsModule {}
