import { Module } from '@nestjs/common';
import { CaptureController } from './capture.controller';
import { QuickCaptureController } from './quick-capture.controller';
import { CaptureService } from './capture.service';
import { ConfirmService } from './confirm.service';
import { CorrectionsService } from './corrections.service';
import { OpenAiParser } from './parsers/openai.parser';
import { IntelligenceModule } from '../intelligence/intelligence.module';

@Module({
  imports: [IntelligenceModule],
  controllers: [CaptureController, QuickCaptureController],
  providers: [CaptureService, ConfirmService, CorrectionsService, OpenAiParser],
  exports: [CorrectionsService],
})
export class CaptureModule {}
