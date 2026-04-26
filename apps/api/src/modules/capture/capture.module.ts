import { Module } from '@nestjs/common';
import { CaptureController } from './capture.controller';
import { CaptureService } from './capture.service';
import { ConfirmService } from './confirm.service';
import { OpenAiParser } from './parsers/openai.parser';

@Module({
  controllers: [CaptureController],
  providers: [CaptureService, ConfirmService, OpenAiParser],
})
export class CaptureModule {}
