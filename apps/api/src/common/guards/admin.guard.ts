import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Round-18: minimal `role === 'ADMIN'` check. Stack ABOVE `JwtAuthGuard`
 * so `req.user.id` is populated. We re-fetch the user from Postgres rather
 * than trusting the JWT claim — the JWT carries only `sub`/`email`, not
 * the role, so a freshly-promoted admin (or freshly-demoted ex-admin)
 * always sees the canonical state.
 *
 * Throws 403 with `errorCode: 'ADMIN_REQUIRED'` for non-admins.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: { id?: string } }>();
    const userId = req.user?.id;
    if (!userId) {
      throw new ForbiddenException({ errorCode: 'ADMIN_REQUIRED' });
    }
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });
    if (!u || u.status !== 'ACTIVE' || u.role !== 'ADMIN') {
      throw new ForbiddenException({ errorCode: 'ADMIN_REQUIRED' });
    }
    return true;
  }
}
