import { Body } from '@nestjs/common';
import {
  SetupOpenAiKeyRequestSchema,
  type SetupOpenAiKeyRequest,
} from '@lifeos/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

export type { SetupOpenAiKeyRequest };
export const SetupOpenAiKeyBody = () =>
  Body(new ZodValidationPipe(SetupOpenAiKeyRequestSchema));
