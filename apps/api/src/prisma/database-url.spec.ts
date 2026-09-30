import { resolveDatabaseUrl } from './database-url';

describe('resolveDatabaseUrl', () => {
  const pooler = 'postgres://postgres.ref:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require';
  const neon = 'postgresql://u:pw@ep-cool-123-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require';
  it('returns undefined with no database configured', () => expect(resolveDatabaseUrl({})).toBeUndefined());
  it('prefers an explicit DATABASE_URL', () => {
    expect(new URL(resolveDatabaseUrl({ DATABASE_URL: 'postgres://a:b@h:5432/x', POSTGRES_URL_NON_POOLING: pooler })!).host).toBe('h:5432');
  });
  it('falls back to the integration URL', () => {
    const u = new URL(resolveDatabaseUrl({ POSTGRES_URL_NON_POOLING: pooler })!);
    expect(u.password).toBe('pw');
    expect(u.searchParams.has('schema')).toBe(false); // no schema unless requested
  });
  it('applies DB_SCHEMA only when set and never overrides an explicit one', () => {
    expect(new URL(resolveDatabaseUrl({ DATABASE_URL: pooler, DB_SCHEMA: 'acme' })!).searchParams.get('schema')).toBe('acme');
    expect(new URL(resolveDatabaseUrl({ DATABASE_URL: pooler + '&schema=custom', DB_SCHEMA: 'acme' })!).searchParams.get('schema')).toBe('custom');
  });
  it('marks Neon pooled endpoints as pgbouncer, but not direct ones', () => {
    expect(new URL(resolveDatabaseUrl({ DATABASE_URL: neon })!).searchParams.get('pgbouncer')).toBe('true');
    expect(new URL(resolveDatabaseUrl({ DATABASE_URL: neon.replace('-pooler', '') })!).searchParams.has('pgbouncer')).toBe(false);
  });
  it('limits connections on Vercel only', () => {
    expect(new URL(resolveDatabaseUrl({ DATABASE_URL: pooler, VERCEL: '1' })!).searchParams.get('connection_limit')).toBe('1');
    expect(new URL(resolveDatabaseUrl({ DATABASE_URL: pooler })!).searchParams.has('connection_limit')).toBe(false);
  });
});
