import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { AssistantMemoryService } from './assistant-memory.service';

@ApiBearerAuth()
@ApiTags('intelligence')
@Controller('memory')
export class MemoryController {
  constructor(private readonly svc: AssistantMemoryService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const rows = await this.svc.list(user.id);
    return rows.map((r) => ({
      id: r.id,
      fact: r.fact,
      kind: r.kind,
      weight: r.weight,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  @Delete(':id')
  forget(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.svc.forget(user.id, id);
  }

  @Post(':id/confirm')
  async confirm(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.svc.confirm(user.id, id);
    return { id, confirmed: true };
  }
}
