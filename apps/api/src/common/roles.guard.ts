import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MemberRole } from '@prisma/client';
import { PERMISSION_KEY, ROLES_KEY } from './decorators';
import { AuthedRequest } from './tenant';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const roles = this.reflector.getAllAndOverride<MemberRole[]>(ROLES_KEY, targets);
    const permission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, targets);
    if (!roles && !permission) return true;

    const t = ctx.switchToHttp().getRequest<AuthedRequest>().tenant;
    if (!t) return true; // public or platform-admin route; AuthGuard already decided

    if (roles && !roles.includes(t.role)) throw new ForbiddenException('Permisos insuficientes');
    if (permission && t.role === 'EMPLOYEE' && !t.permissions.includes(permission)) {
      throw new ForbiddenException('Permisos insuficientes');
    }
    return true;
  }
}
