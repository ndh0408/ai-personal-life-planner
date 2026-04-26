import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { AssistantService } from './assistant.service';
import { SendMessageBody, type SendMessageRequest } from './dto';

@ApiBearerAuth()
@ApiTags('assistant')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly svc: AssistantService) {}

  // 20 turns / minute / IP — generous for normal chat, throttles abuse.
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('messages')
  @HttpCode(HttpStatus.OK)
  send(@CurrentUser() user: AuthenticatedUser, @SendMessageBody() body: SendMessageRequest) {
    return this.svc.send(user.id, body);
  }

  @Get('conversations')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.list(user.id);
  }

  @Get('conversations/:id')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.svc.detail(user.id, id);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.svc.remove(user.id, id);
  }
}
