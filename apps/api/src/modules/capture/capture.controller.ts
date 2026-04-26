import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { CaptureService } from './capture.service';
import { ConfirmService } from './confirm.service';
import {
  ConfirmBody,
  ParseBody,
  type CaptureConfirmRequest,
  type CaptureParseRequest,
} from './dto';

@ApiBearerAuth()
@ApiTags('capture')
@Controller('capture')
export class CaptureController {
  constructor(
    private readonly capture: CaptureService,
    private readonly confirm: ConfirmService,
  ) {}

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('parse')
  @HttpCode(HttpStatus.OK)
  parse(@CurrentUser() user: AuthenticatedUser, @ParseBody() body: CaptureParseRequest) {
    return this.capture.parse(user.id, body);
  }

  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Post('confirm')
  @HttpCode(HttpStatus.CREATED)
  confirmOne(
    @CurrentUser() user: AuthenticatedUser,
    @ConfirmBody() body: CaptureConfirmRequest,
  ) {
    return this.confirm.confirm(user.id, body);
  }
}
