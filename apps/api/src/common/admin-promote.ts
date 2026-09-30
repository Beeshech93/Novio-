import * as bcrypt from 'bcryptjs';

interface AdminStore {
  user: {
    findFirst(a: { where: { email: string; deletedAt: null } }): Promise<{ id: string; platformRole: string } | null>;
    update(a: { where: { id: string }; data: { platformRole: 'SUPER_ADMIN'; emailVerified?: boolean } }): Promise<unknown>;
    create(a: { data: Record<string, unknown> }): Promise<unknown>;
  };
  auditLog: { create(a: { data: Record<string, unknown> }): Promise<unknown> };
}

export type AdminResult = 'skipped' | 'not-registered' | 'already-admin' | 'promoted' | 'created';

/**
 * Makes one person a platform SUPER_ADMIN, driven by environment variables so no password ever travels through chat:
 *  - ADMIN_EMAIL only: promotes that user IF they already registered normally (never creates an account).
 *  - ADMIN_EMAIL + ADMIN_PASSWORD (12+ chars): creates the account when it doesn't exist yet.
 * Idempotent; safe to run on every production build.
 */
export async function ensureAdmin(db: AdminStore, env: NodeJS.ProcessEnv = process.env): Promise<AdminResult> {
  const email = env.ADMIN_EMAIL?.toLowerCase().trim();
  if (!email) return 'skipped';

  const existing = await db.user.findFirst({ where: { email, deletedAt: null } });
  if (existing) {
    if (existing.platformRole === 'SUPER_ADMIN') return 'already-admin';
    await db.user.update({ where: { id: existing.id }, data: { platformRole: 'SUPER_ADMIN' } });
    await db.auditLog.create({ data: { userId: existing.id, action: 'admin.promoted_by_config' } });
    return 'promoted';
  }
  if (!env.ADMIN_PASSWORD) return 'not-registered';
  if (env.ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');
  await db.user.create({
    data: { email, name: 'Nuvio Admin', passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, 12), platformRole: 'SUPER_ADMIN', emailVerified: true },
  });
  return 'created';
}
