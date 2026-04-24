import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateMealPlanSchema,
  UpdateMealPlanSchema,
  GetMealPlanQuerySchema,
  type CreateMealPlanInput,
  type UpdateMealPlanInput,
  type GetMealPlanQuery,
} from '@planner/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ok } from '../../common/interceptors/response.interceptor';
import { MealsService } from './meals.service';

@Controller('meals')
@UseGuards(JwtAuthGuard)
export class MealsController {
  constructor(private readonly meals: MealsService) {}

  @Get()
  async getByDate(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(GetMealPlanQuerySchema)) query: GetMealPlanQuery,
  ) {
    const plan = await this.meals.getByDate(user.id, query.date);
    return ok(plan, plan ? 'Meal plan retrieved' : 'No meal plan for this date');
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateMealPlanSchema)) body: CreateMealPlanInput,
  ) {
    const plan = await this.meals.create(user.id, body);
    return ok(plan, 'Meal plan created');
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateMealPlanSchema)) body: UpdateMealPlanInput,
  ) {
    const plan = await this.meals.update(user.id, id, body);
    return ok(plan, 'Meal plan updated');
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.meals.delete(user.id, id);
    return ok(null, 'Meal plan deleted');
  }
}
