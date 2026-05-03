import { Module } from '@nestjs/common';
import { PromptRegistryService } from './prompt-registry.service';
import { PromptsController } from './prompts.controller';

@Module({
  controllers: [PromptsController],
  providers: [PromptRegistryService],
  exports: [PromptRegistryService],
})
export class PromptsModule {}
