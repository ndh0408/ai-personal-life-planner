import { Global, Module } from '@nestjs/common';
import { EncryptionModule } from '../crypto/encryption.module';
import { LlmService } from './llm.service';

/**
 * Global LlmService — every feature module imports it without re-providing.
 * Marked @Global so callers don't have to thread imports through deep
 * module trees (capture/intelligence/assistant all need it).
 */
@Global()
@Module({
  imports: [EncryptionModule],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
