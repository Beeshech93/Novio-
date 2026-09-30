import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { AuthedRequest, TenantContext } from './tenant';

export const ROLES_KEY = 'roles';
export const PUBLIC_KEY = 'public';
export const PERMISSION_KEY = 'permission';
export const PLATFORM_ADMIN_KEY = 'platformAdmin';

export const Roles = (...roles: MemberRole[]) => SetMetadata(ROLES_KEY, roles);
export const Public = () => SetMetadata(PUBLIC_KEY, true);
/** EMPLOYEE members need this permission string; OWNER/MANAGER always pass. */
export const RequirePermission = (p: string) => SetMetadata(PERMISSION_KEY, p);
export const PlatformAdmin = () => SetMetadata(PLATFORM_ADMIN_KEY, true);

export const Tenant = createParamDecorator((_: unknown, ctx: ExecutionContext): TenantContext => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().tenant as TenantContext;
});
