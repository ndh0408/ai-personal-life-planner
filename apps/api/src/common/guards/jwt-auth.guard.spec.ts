import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

const SECRET = 'test-access-secret-test-access-secret-32+';
const REFRESH_SECRET = 'test-refresh-secret-test-refresh-secret-32+';

/** Reflector requires a real function/class to scan for metadata. Anything
 *  callable works — it just won't have the @Public() flag set. */
class FakeController {}
function fakeHandler(): void {
  /* noop */
}

function fakeCtx(authHeader?: string): {
  ctx: ExecutionContext;
  req: { headers: Record<string, string | undefined>; user?: unknown };
} {
  const req: { headers: Record<string, string | undefined>; user?: unknown } = {
    headers: { authorization: authHeader },
  };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => fakeHandler,
    getClass: () => FakeController,
  } as unknown as ExecutionContext;
  return { ctx, req };
}

function makeGuard() {
  const jwt = new JwtService({ secret: SECRET });
  const reflector = new Reflector();
  const config = {
    getOrThrow: (k: string) => {
      if (k === 'JWT_ACCESS_SECRET') return SECRET;
      throw new Error('missing');
    },
  } as unknown as ConfigService;
  return { guard: new JwtAuthGuard(jwt, reflector, config), jwt };
}

describe('JwtAuthGuard', () => {
  it('attaches user when token is a valid access token', async () => {
    const { guard, jwt } = makeGuard();
    const token = await jwt.signAsync(
      { sub: 'u1', email: 'a@b.com', type: 'access' },
      { secret: SECRET, expiresIn: '5m' },
    );
    const { ctx, req } = fakeCtx(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect((req as { user: unknown }).user).toEqual({ id: 'u1', email: 'a@b.com' });
  });

  it('rejects refresh tokens (type !== "access")', async () => {
    const { guard, jwt } = makeGuard();
    const token = await jwt.signAsync(
      { sub: 'u1', jti: 'r1', type: 'refresh' },
      // Sign with the *access* secret so verify succeeds — proves we reject by
      // type, not by signature alone (defence in depth).
      { secret: SECRET, expiresIn: '5m' },
    );
    const { ctx } = fakeCtx(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects tokens missing the type claim', async () => {
    const { guard, jwt } = makeGuard();
    const token = await jwt.signAsync({ sub: 'u1', email: 'a@b.com' }, { secret: SECRET });
    const { ctx } = fakeCtx(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when Authorization header is missing', async () => {
    const { guard } = makeGuard();
    const { ctx } = fakeCtx(undefined);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects malformed/expired tokens', async () => {
    const { guard } = makeGuard();
    const { ctx } = fakeCtx('Bearer not-a-jwt');
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects tokens signed with the wrong (refresh) secret', async () => {
    const { guard } = makeGuard();
    const refreshOnlyJwt = new JwtService({ secret: REFRESH_SECRET });
    const token = await refreshOnlyJwt.signAsync(
      { sub: 'u1', email: 'a@b.com', type: 'access' },
      { secret: REFRESH_SECRET, expiresIn: '5m' },
    );
    const { ctx } = fakeCtx(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
