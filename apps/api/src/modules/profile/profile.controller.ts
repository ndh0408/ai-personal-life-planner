import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { UpdateProfileSchema, type UpdateProfileInput } from '@planner/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ok } from '../../common/interceptors/response.interceptor';
import { ProfileService } from './profile.service';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  async get(@CurrentUser() user: AuthUser) {
    const result = await this.profile.get(user.id);
    return ok(result, result.exists ? 'Profile retrieved' : 'Profile not yet created');
  }

  @Put()
  async update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpdateProfileSchema)) body: UpdateProfileInput,
  ) {
    const { profile, created } = await this.profile.upsert(user.id, body);
    return ok(profile, created ? 'Profile created' : 'Profile updated');
  }
}
