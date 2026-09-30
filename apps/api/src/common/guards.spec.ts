import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';

function ctx(req: any, meta: Record<string, unknown> = {}): ExecutionContext {
  return {
    getHandler: () => ({ meta }),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
}
const reflector = (meta: Record<string, unknown>) =>
  ({ getAllAndOverride: (k: string) => meta[k] }) as unknown as Reflector;

describe('AuthGuard tenant isolation', () => {
  const prisma: any = {
    user: { findFirst: jest.fn().mockResolvedValue({ id: 'u1', platformRole: 'USER' }) },
    businessMember: { findMany: jest.fn() },
  };
  const jwt: any = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'u1' }) };
  const guard = new AuthGuard(jwt, prisma, reflector({}));

  it('rejects requests without token', async () => {
    await expect(guard.canActivate(ctx({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("denies a business the user is not a member of", async () => {
    prisma.businessMember.findMany.mockResolvedValue([]);
    const req = { headers: { authorization: 'Bearer t', 'x-business-id': 'other-biz' } };
    await expect(guard.canActivate(ctx(req))).rejects.toBeInstanceOf(ForbiddenException);
    // membership lookup was constrained to the requested id AND the user
    expect(prisma.businessMember.findMany.mock.calls[0][0].where).toMatchObject({ userId: 'u1', businessId: 'other-biz' });
  });

  it('sets tenant from membership', async () => {
    prisma.businessMember.findMany.mockResolvedValue([{ businessId: 'b1', role: 'OWNER', permissions: [] }]);
    const req: any = { headers: { authorization: 'Bearer t' } };
    await guard.canActivate(ctx(req));
    expect(req.tenant).toMatchObject({ userId: 'u1', businessId: 'b1', role: 'OWNER' });
  });
});

describe('RolesGuard', () => {
  const run = (meta: any, tenant: any) => new RolesGuard(reflector(meta)).canActivate(ctx({ tenant }));

  it('blocks roles not listed', () => {
    expect(() => run({ roles: ['OWNER'] }, { role: 'EMPLOYEE', permissions: [] })).toThrow(ForbiddenException);
  });
  it('allows listed roles', () => {
    expect(run({ roles: ['OWNER', 'MANAGER'] }, { role: 'MANAGER', permissions: [] })).toBe(true);
  });
  it('requires configured permission for employees only', () => {
    expect(() => run({ permission: 'products.write' }, { role: 'EMPLOYEE', permissions: [] })).toThrow(ForbiddenException);
    expect(run({ permission: 'products.write' }, { role: 'EMPLOYEE', permissions: ['products.write'] })).toBe(true);
    expect(run({ permission: 'products.write' }, { role: 'MANAGER', permissions: [] })).toBe(true);
  });
});

describe('AuthGuard platform-admin 2FA requirement', () => {
  const run = async (user: any, key?: string) => {
    const saved = process.env.TWOFA_ENCRYPTION_KEY;
    if (key) process.env.TWOFA_ENCRYPTION_KEY = key; else delete process.env.TWOFA_ENCRYPTION_KEY;
    try {
      const prisma: any = { user: { findFirst: jest.fn().mockResolvedValue(user) } };
      const guard = new AuthGuard({ verifyAsync: jest.fn().mockResolvedValue({ sub: 'u1' }) } as any, prisma, reflector({ platformAdmin: true }));
      return await guard.canActivate(ctx({ headers: { authorization: 'Bearer t' } }));
    } finally { if (saved) process.env.TWOFA_ENCRYPTION_KEY = saved; else delete process.env.TWOFA_ENCRYPTION_KEY; }
  };
  const admin = (totpEnabled: boolean) => ({ id: 'u1', platformRole: 'SUPER_ADMIN', totpEnabled });
  const KEY = 'a'.repeat(64);

  it('blocks an admin without 2FA when the server supports 2FA', async () => {
    await expect(run(admin(false), KEY)).rejects.toThrow('ADMIN_2FA_REQUIRED');
  });
  it('lets an admin with 2FA through', async () => expect(await run(admin(true), KEY)).toBe(true));
  it('does not lock the admin out when 2FA cannot be configured on the server', async () => expect(await run(admin(false))).toBe(true));
  it('still rejects non-admins', async () => {
    await expect(run({ id: 'u2', platformRole: 'USER', totpEnabled: true }, KEY)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
