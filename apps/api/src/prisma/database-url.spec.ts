import { resolveDatabaseUrl } from './database-url';

describe('resolveDatabaseUrl', () => {
  const pooler = 'postgres://postgres.ref:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require';
  it('returns undefined with no database configured', () => expect(resolveDatabaseUrl({})).toBeUndefined());
  it('prefers an explicit DATABASE_URL', () => {
    const u = new URL(resolveDatabaseUrl({ DATABASE_URL: 'postgres://a:b@h:5432/x', POSTGRES_URL_NON_POOLING: pooler })!);
    expect(u.host).toBe('h:5432');
  });
  it('falls back to the integration URL and appends the nuvio schema', () => {
    const u = new URL(resolveDatabaseUrl({ POSTGRES_URL_NON_POOLING: pooler })!);
    expect(u.searchParams.get('schema')).toBe('nuvio');
    expect(u.searchParams.get('sslmode')).toBe('require');
    expect(u.password).toBe('pw');
  });
  it('keeps an explicit schema and honours DB_SCHEMA', () => {
    expect(new URL(resolveDatabaseUrl({ DATABASE_URL: pooler + '&schema=custom' })!).searchParams.get('schema')).toBe('custom');
    expect(new URL(resolveDatabaseUrl({ DATABASE_URL: pooler, DB_SCHEMA: 'acme' })!).searchParams.get('schema')).toBe('acme');
  });
  it('limits connections on Vercel only', () => {
    expect(new URL(resolveDatabaseUrl({ DATABASE_URL: pooler, VERCEL: '1' })!).searchParams.get('connection_limit')).toBe('1');
    expect(new URL(resolveDatabaseUrl({ DATABASE_URL: pooler })!).searchParams.has('connection_limit')).toBe(false);
  });
});
