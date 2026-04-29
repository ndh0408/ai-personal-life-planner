import { Body, Controller, Get, Patch, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UpdatePrivacyRequestSchema, type UpdatePrivacyRequest } from '@lifeos/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrivacyService } from './privacy.service';

@ApiTags('privacy')
@ApiBearerAuth()
@Controller('privacy')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.privacy.get(user.id);
  }

  @Patch()
  @UsePipes(new ZodValidationPipe(UpdatePrivacyRequestSchema))
  update(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdatePrivacyRequest) {
    return this.privacy.update(user.id, body);
  }
}
