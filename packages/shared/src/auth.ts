import { z } from 'zod';
import { LocaleSchema } from './common';

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(80).optional(),
  locale: LocaleSchema.optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

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
  locale: LocaleSchema,
  createdAt: z.string(),
});
export type UserPublic = z.infer<typeof UserPublicSchema>;

export const AuthResponseSchema = z.object({
  user: UserPublicSchema,
  tokens: AuthTokensSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
