import { Body, Controller, Post, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AiChatRequestSchema, type AiChatRequest } from '@planner/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AiService } from './ai.service';

@Controller('ai')
@UseGuards(AuthGuard('jwt-access'))
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('chat')
  @UsePipes(new ZodValidationPipe(AiChatRequestSchema))
  chat(@Body() body: AiChatRequest) {
    return this.ai.chat(body);
  }
}
