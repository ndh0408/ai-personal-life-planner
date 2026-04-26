import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { UserAiKeyService } from './user-ai-key.service';
import { SetupOpenAiKeyBody, type SetupOpenAiKeyRequest } from './dto';

@ApiBearerAuth()
@ApiTags('ai-key')
@Controller('ai-key')
export class UserAiKeyController {
  constructor(private readonly svc: UserAiKeyService) {}

  // The setup-openai call also tests the key against OpenAI, which is
  // outbound network + ~hundreds of ms — keep the limit modest per IP.
  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  @Post('setup-openai')
  @HttpCode(HttpStatus.OK)
  setupOpenAi(@CurrentUser() user: AuthenticatedUser, @SetupOpenAiKeyBody() body: SetupOpenAiKeyRequest) {
    return this.svc.setupOpenAi(user.id, body.apiKey);
  }

  @Throttle({ default: { ttl: 60_000, limit: 12 } })
  @Post('test')
  @HttpCode(HttpStatus.OK)
  test(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.testStored(user.id);
  }

  @Get('status')
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.statusFor(user.id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser) {
    await this.svc.deleteFor(user.id);
  }
}
