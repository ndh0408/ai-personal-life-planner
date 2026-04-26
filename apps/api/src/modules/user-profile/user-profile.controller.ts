import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  UpdateProfileRequestSchema,
  type UpdateProfileRequest,
} from '@lifeos/shared';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UserProfileService } from './user-profile.service';

@ApiBearerAuth()
@ApiTags('profile')
@Controller('profile')
export class UserProfileController {
  constructor(private readonly svc: UserProfileService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getOrCreate(user.id);
  }

  @Patch()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(UpdateProfileRequestSchema))
    body: UpdateProfileRequest,
  ) {
    return this.svc.update(user.id, body);
  }
}
