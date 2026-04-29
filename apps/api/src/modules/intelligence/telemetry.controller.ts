/**
 * Mobile telemetry sink (round 35).
 *
 * Lets the app log lightweight UX events — screen opened, quick action
 * tapped — into the same EventLog stream the assistant + behaviour
 * services already read. Privacy-respecting:
 *   - body schema only accepts a fixed enum of kinds; arbitrary kinds
 *     are rejected at the controller layer.
 *   - payload is small (≤ 1 KB) and runs through EventLogService's
 *     redactor before write.
 *   - tied to the authenticated user — no anonymous telemetry.
 *
 * The endpoint is best-effort: a failure here must never break the user
 * flow that triggered it. The mobile client `void`s the call.
 */
import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { EventLogService, type EventKind } from './event-log.service';

const ALLOWED_KINDS: EventKind[] = [
  'SCREEN_OPENED',
  'QUICK_ACTION_USED',
  'INSIGHT_VIEWED',
  'ASSISTANT_ACTION_TAPPED',
  'TASK_RESCHEDULED',
];

interface TelemetryBody {
  kind: EventKind;
  /** Short summary string. Capped at 280 by EventLogService. */
  summary?: string;
  payload?: Record<string, unknown>;
}

@ApiBearerAuth()
@ApiTags('telemetry')
@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly events: EventLogService) {}

  // 120/min/IP — generous for screen-open spam, throttles abuse.
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @Post('events')
  @HttpCode(HttpStatus.NO_CONTENT)
  async log(@CurrentUser() user: AuthenticatedUser, @Body() body: TelemetryBody): Promise<void> {
    if (!body || typeof body.kind !== 'string' || !ALLOWED_KINDS.includes(body.kind)) {
      throw new BadRequestException({
        error: { code: 'TELEMETRY_BAD_KIND', message: 'Unsupported event kind' },
      });
    }
    await this.events.log(user.id, body.kind, body.summary ?? body.kind, body.payload);
  }
}
