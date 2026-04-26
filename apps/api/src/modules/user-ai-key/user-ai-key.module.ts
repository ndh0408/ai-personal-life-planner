import { Module } from '@nestjs/common';
import { UserAiKeyController } from './user-ai-key.controller';
import { UserAiKeyService } from './user-ai-key.service';

@Module({
  controllers: [UserAiKeyController],
  providers: [UserAiKeyService],
  exports: [UserAiKeyService],
})
export class UserAiKeyModule {}
