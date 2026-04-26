import { Body } from '@nestjs/common';
import { SendMessageRequestSchema, type SendMessageRequest } from '@lifeos/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

export type { SendMessageRequest };
export const SendMessageBody = () => Body(new ZodValidationPipe(SendMessageRequestSchema));
