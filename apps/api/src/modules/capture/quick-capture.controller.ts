/**
 * Alias for the Capture endpoints under the spec-friendly path
 * /api/quick-capture/*. Both /api/capture/* and /api/quick-capture/*
 * route to the same services — pick whichever path is more readable
 * for your client. New mobile work uses /api/capture for consistency
 * with existing code.
 */
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
@ApiTags('quick-capture')
@Controller('quick-capture')
export class QuickCaptureController {
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
