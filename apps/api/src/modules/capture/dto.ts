import { Body } from '@nestjs/common';
import {
  CaptureParseRequestSchema,
  CaptureConfirmRequestSchema,
  type CaptureParseRequest,
  type CaptureConfirmRequest,
} from '@lifeos/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

export type { CaptureParseRequest, CaptureConfirmRequest };
export const ParseBody = () => Body(new ZodValidationPipe(CaptureParseRequestSchema));
export const ConfirmBody = () => Body(new ZodValidationPipe(CaptureConfirmRequestSchema));
