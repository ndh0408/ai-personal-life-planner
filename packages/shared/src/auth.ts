import { z } from 'zod';
import { LocaleSchema } from './common';

export const RegisterRequestSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(128),
  displayName: z.string().min(1).max(80).optional(),
  locale: LocaleSchema.optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(20).max(2048),
});
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

export const LogoutRequestSchema = z.object({
  refreshToken: z.string().min(20).max(2048).optional(),
});
export type LogoutRequest = z.infer<typeof LogoutRequestSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  accessTokenExpiresAt: z.string(),
  refreshTokenExpiresAt: z.string(),
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const UserPublicSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  emailVerifiedAt: z.string().nullable(),
  status: z.enum(['ACTIVE', 'DISABLED']),
  createdAt: z.string(),
});
export type UserPublic = z.infer<typeof UserPublicSchema>;

export const AuthResponseSchema = z.object({
  user: UserPublicSchema,
  tokens: AuthTokensSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/**
 * Stable error codes the mobile client switches on. Add — never repurpose.
 */
export const AUTH_ERROR_CODES = [
  'EMAIL_TAKEN',
  'INVALID_CREDENTIALS',
  'ACCOUNT_DISABLED',
  'INVALID_REFRESH_TOKEN',
  'REFRESH_TOKEN_EXPIRED',
  'REFRESH_TOKEN_REVOKED',
  'UNAUTHENTICATED',
  'INVALID_TOKEN',
] as const;
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];
