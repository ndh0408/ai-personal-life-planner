import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiChatRequest } from '@planner/shared';

/**
 * AI calls live behind the API. The mobile app NEVER talks to AI providers
 * directly — that keeps the API key server-side and lets us add caching,
 * auth, rate limiting and audit logs in one place.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly config: ConfigService) {}

  async chat(req: AiChatRequest): Promise<{ reply: string }> {
    const provider = this.config.get<string>('AI_PROVIDER', 'mock');
    if (provider === 'mock' || !this.config.get<string>('AI_API_KEY')) {
      return { reply: '[mock] AI provider not configured. Set AI_API_KEY to enable real responses.' };
    }
    // Real provider integration belongs here in a future iteration.
    this.logger.log(`AI chat request (${req.messages.length} messages) → ${provider}`);
    return { reply: '[stub] real AI provider integration not yet implemented.' };
  }
}
