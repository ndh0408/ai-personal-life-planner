import { Controller, Get } from '@nestjs/common';
import { PromptRegistryService } from './prompt-registry.service';

/**
 * Read-only catalog of prompts — useful for the eval harness, /admin pages,
 * and "Why this?" deep-link debugging. No PII, no secrets; safe to expose
 * to authenticated users (auth guard applied globally).
 */
@Controller('prompts')
export class PromptsController {
  constructor(private readonly registry: PromptRegistryService) {}

  @Get()
  list() {
    return this.registry.list().map((p) => ({
      id: p.id,
      version: p.version,
      defaultModel: p.defaultModel,
      temperature: p.temperature,
    }));
  }
}
