/**
 * Resolves the Postgres URL used at runtime.
 *  1. DATABASE_URL (Neon/Vercel integrations inject it), else POSTGRES_URL_NON_POOLING.
 *  2. DB_SCHEMA, when set, selects a dedicated Postgres schema (useful on a shared database).
 *  3. Pooled endpoints (host contains "-pooler", i.e. PgBouncer in transaction mode) need pgbouncer=true
 *     so Prisma doesn't rely on session-level prepared statements.
 */
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const raw = env.DATABASE_URL || env.POSTGRES_URL_NON_POOLING;
  if (!raw) return undefined;
  const url = new URL(raw);
  if (env.DB_SCHEMA && !url.searchParams.has('schema')) url.searchParams.set('schema', env.DB_SCHEMA);
  if (url.hostname.includes('-pooler') && !url.searchParams.has('pgbouncer')) url.searchParams.set('pgbouncer', 'true');
  // Serverless: one connection per function instance, or the pooler's client cap is exhausted quickly.
  if (env.VERCEL && !url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '1');
  return url.toString();
}
