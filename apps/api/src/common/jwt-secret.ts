import { Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';

interface SecretStore {
  appSecret: {
    findUnique(a: { where: { key: string } }): Promise<{ value: string } | null>;
    createMany(a: { data: { key: string; value: string }[]; skipDuplicates: boolean }): Promise<unknown>;
  };
}

const KEY = 'jwt_secret';

/**
 * Session-signing key. JWT_SECRET from the environment always wins. If it isn't set, the server
 * generates a strong random key once and keeps it in the database (table app_secrets, RLS-protected),
 * so every serverless instance shares the same key and nobody has to paste one anywhere.
 * Set ALLOW_GENERATED_JWT_SECRET=0 to require the environment variable instead.
 */
export async function resolveJwtSecret(prisma: SecretStore, env: NodeJS.ProcessEnv = process.env): Promise<string> {
  if (env.JWT_SECRET) {
    if (env.JWT_SECRET.length < 16) throw new Error('JWT_SECRET must be 16+ chars');
    return env.JWT_SECRET;
  }
  if (env.ALLOW_GENERATED_JWT_SECRET === '0') throw new Error('JWT_SECRET must be set (16+ chars)');

  let row = await prisma.appSecret.findUnique({ where: { key: KEY } });
  if (!row) {
    // skipDuplicates makes concurrent first boots converge on one winner; everyone then re-reads it.
    await prisma.appSecret.createMany({ data: [{ key: KEY, value: randomBytes(48).toString('base64url') }], skipDuplicates: true });
    row = await prisma.appSecret.findUnique({ where: { key: KEY } });
    new Logger('Security').warn('Generated a session-signing key and stored it in the database. Set JWT_SECRET to manage it yourself.');
  }
  if (!row) throw new Error('Could not obtain a session-signing key');
  return row.value;
}
