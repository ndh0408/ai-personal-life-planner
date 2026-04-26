import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { WalletsService } from './wallets.service';

const CreateWalletSchema = z.object({
  name: z.string().min(1).max(80),
  initialBalance: z.number().min(0).max(1e15).optional(),
  currency: z.string().min(2).max(8).optional(),
  isDefault: z.boolean().optional(),
});

@ApiBearerAuth()
@ApiTags('wallets')
@Controller('wallets')
export class WalletsController {
  constructor(private readonly svc: WalletsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.list(user.id);
  }

  @Get('default')
  getDefault(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getDefault(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const r = CreateWalletSchema.safeParse(body);
    if (!r.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Dữ liệu ví không hợp lệ.',
          issues: r.error.issues,
        },
      });
    }
    return this.svc.create(user.id, r.data);
  }
}
