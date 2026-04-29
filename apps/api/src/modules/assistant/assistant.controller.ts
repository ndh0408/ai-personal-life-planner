import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AiMessageRole } from '@prisma/client';
import { defer, from, Observable } from 'rxjs';
import { map, finalize } from 'rxjs/operators';
import { randomBytes } from 'crypto';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AssistantService } from './assistant.service';
import { AssistantStreamingService } from './assistant.streaming.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SendMessageBody, type SendMessageRequest } from './dto';

@ApiBearerAuth()
@ApiTags('assistant')
@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly svc: AssistantService,
    private readonly streaming: AssistantStreamingService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

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

  /**
   * Round 24: open the user's message + immediately return its id so the
   * client can subscribe to the stream endpoint. Persisting the user
   * message here (vs inside the stream generator) lets a client retry
   * subscription on reconnect without losing the prompt.
   */
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('messages/stream-open')
  @HttpCode(HttpStatus.CREATED)
  async openStream(
    @CurrentUser() user: AuthenticatedUser,
    @SendMessageBody() body: SendMessageRequest,
  ) {
    const conversation = body.conversationId
      ? await this.prisma.aIConversation.findUnique({ where: { id: body.conversationId } })
      : await this.prisma.aIConversation.create({
          data: { userId: user.id, title: body.content.slice(0, 60) },
        });
    if (!conversation || conversation.userId !== user.id) {
      throw new BadRequestException({
        error: { code: 'NOT_FOUND', message: 'Hội thoại không tồn tại.' },
      });
    }
    const userMsg = await this.prisma.aIMessage.create({
      data: {
        userId: user.id,
        conversationId: conversation.id,
        role: AiMessageRole.USER,
        content: body.content,
      },
    });
    // Pre-mint the assistant message id so SSE events can reference it
    // before the row exists (the streaming service writes the row last).
    const assistantMsgId = randomBytes(12).toString('base64url');
    return {
      conversationId: conversation.id,
      threadId: conversation.id,
      userMessageId: userMsg.id,
      assistantMessageId: assistantMsgId,
    };
  }

  /**
   * SSE endpoint. Browsers and curl can consume this directly; the mobile
   * app reads it via fetch streaming once react-native-sse lands. Auth is
   * via ?token= because EventSource (web) can't set Authorization headers.
   */
  @Public()
  @Sse('messages/stream')
  stream(
    @Query('token') token: string,
    @Query('threadId') threadId: string,
    @Query('messageId') messageId: string,
    @Query('userText') userText: string,
  ): Observable<MessageEvent> {
    return defer(async () => {
      // Manual auth — Public() so the global JwtAuthGuard skips it.
      if (!token) {
        throw new BadRequestException({ error: { code: 'missing_token', message: 'Token bắt buộc' } });
      }
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string; type?: string }>(
        token,
        { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET') },
      );
      if (payload.type !== 'access') {
        throw new BadRequestException({ error: { code: 'wrong_token_type', message: 'Wrong token type' } });
      }
      return { userId: payload.sub };
    }).pipe(
      // Wrap the async generator into an observable of MessageEvents.
      // Each Nest @Sse() emission must be { data, type? }.
      // We pass `type` as the SSE event field and `data` as serialised JSON.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map((auth: any) => auth),
      // Switch to the generator only after auth resolved.
      // We have to flatten manually since rxjs in-Nest patterns expect
      // a simple Observable<MessageEvent>.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (source$: any) => {
        return new Observable<MessageEvent>((subscriber) => {
          let cancelled = false;
          (async () => {
            try {
              const auth = await source$.toPromise();
              const userId = auth.userId as string;
              for await (const ev of this.streaming.run({
                userId,
                threadId,
                messageId,
                conversationId: threadId,
                userText,
              })) {
                if (cancelled) break;
                subscriber.next({
                  data: JSON.stringify(ev),
                  type: ev.type,
                } as unknown as MessageEvent);
              }
              subscriber.complete();
            } catch (e) {
              subscriber.error(e);
            }
          })();
          return () => {
            cancelled = true;
          };
        }).pipe(finalize(() => undefined));
      },
      // Help TS infer Observable<MessageEvent> on the chain.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (o: any) => o as Observable<MessageEvent>,
    );
  }
}

// Quiet the unused-from import — kept for future array-based event sources.
void from;
