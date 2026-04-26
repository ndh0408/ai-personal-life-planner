import { Body } from '@nestjs/common';
import {
  LoginRequestSchema,
  LogoutRequestSchema,
  RefreshRequestSchema,
  RegisterRequestSchema,
  type LoginRequest,
  type LogoutRequest,
  type RefreshRequest,
  type RegisterRequest,
} from '@lifeos/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

// Re-export wire types for controller signatures.
export type { LoginRequest, LogoutRequest, RefreshRequest, RegisterRequest };

// Per-route Body decorators wired to the matching Zod schema. This keeps the
// controller signatures terse and ensures we use the @lifeos/shared schemas
// as the single source of truth (no duplicated class-validator DTOs).
export const RegisterBody = () => Body(new ZodValidationPipe(RegisterRequestSchema));
export const LoginBody = () => Body(new ZodValidationPipe(LoginRequestSchema));
export const RefreshBody = () => Body(new ZodValidationPipe(RefreshRequestSchema));
export const LogoutBody = () => Body(new ZodValidationPipe(LogoutRequestSchema));
