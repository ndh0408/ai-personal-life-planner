import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { IncomesService } from './incomes.service';
import type { RangeName } from '../../common/datetime/range';

const ALLOWED: RangeName[] = ['today', 'yesterday', 'week', 'month'];

const CreateIncomeSchema = z.object({
  title: z.string().min(1).max(200),
  amount: z.number().positive().max(1e12),
  category: z.string().min(1).max(40),
  incomeDateIso: z.string().datetime(),
  walletId: z.string().min(1).optional(),
  note: z.string().max(2000).nullable().optional(),
});

const UpdateIncomeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  amount: z.number().positive().max(1e12).optional(),
  category: z.string().min(1).max(40).optional(),
  incomeDateIso: z.string().datetime().optional(),
  note: z.string().max(2000).nullable().optional(),
});

function parseRange(raw: string | undefined): RangeName | null {
  if (!raw) return null;
  if ((ALLOWED as string[]).includes(raw)) return raw as RangeName;
  throw new BadRequestException({
    error: { code: 'BAD_RANGE', message: `range must be one of ${ALLOWED.join(', ')}` },
  });
}

function parseBody<T>(
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: unknown[] } } },
  body: unknown,
): T {
  const r = schema.safeParse(body);
  if (!r.success) {
    throw new BadRequestException({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Dữ liệu không hợp lệ.',
        issues: r.error?.issues,
      },
    });
  }
  return r.data as T;
}

@ApiBearerAuth()
@ApiTags('finance')
@Controller('incomes')
export class IncomesController {
  constructor(private readonly svc: IncomesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('range') range?: string) {
    return this.svc.list(user.id, parseRange(range));
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const input = parseBody(CreateIncomeSchema, body);
    return this.svc.create(user.id, { ...input, idempotencyKey });
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.svc.update(user.id, id, parseBody(UpdateIncomeSchema, body));
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.svc.softDelete(user.id, id);
  }
}
