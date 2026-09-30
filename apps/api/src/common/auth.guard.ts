import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { PLATFORM_ADMIN_KEY, PUBLIC_KEY } from './decorators';
import { AuthedRequest } from './tenant';

export const COOKIE_NAME = 'nuvio_token';

/**
 * Authenticates the JWT (cookie or Bearer) and resolves the tenant.
 * The business is chosen with the `x-business-id` header, but ONLY accepted if the
 * user has a membership in it — this is the tenant-isolation boundary.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private prisma: PrismaService, private reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers['authorization'];
    const bearer = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : undefined;
    const token = bearer ?? req.cookies?.[COOKIE_NAME];
    if (!token) throw new UnauthorizedException();

    let userId: string, issuedAt = 0;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; iat?: number; purpose?: string }>(token);
      if (payload.purpose) throw new UnauthorizedException(); // e.g. 2FA challenge tokens are never valid sessions
      userId = payload.sub; issuedAt = (payload.iat ?? 0) * 1000;
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new UnauthorizedException();
    // Password reset revokes all earlier sessions.
    if (user.passwordChangedAt && issuedAt < user.passwordChangedAt.getTime() - 1000) throw new UnauthorizedException();

    if (this.reflector.getAllAndOverride<boolean>(PLATFORM_ADMIN_KEY, targets)) {
      if (user.platformRole !== 'SUPER_ADMIN') throw new ForbiddenException();
      return true;
    }

    const requested = req.headers['x-business-id'];
    const memberships = await this.prisma.businessMember.findMany({
      where: {
        userId,
        business: { deletedAt: null, status: 'ACTIVE' },
        ...(typeof requested === 'string' ? { businessId: requested } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 1,
    });
    const m = memberships[0];
    // A business id the user does not belong to is indistinguishable from a missing one.
    if (!m) throw new ForbiddenException('No tienes acceso a este negocio');

    req.tenant = {
      userId,
      platformRole: user.platformRole,
      businessId: m.businessId,
      role: m.role,
      permissions: m.permissions,
    };
    return true;
  }
}
