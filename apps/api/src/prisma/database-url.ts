/**
 * Resolves the Postgres URL used at runtime.
 *  1. DATABASE_URL, if set (explicit always wins).
 *  2. Otherwise POSTGRES_URL_NON_POOLING, which the Vercel <-> Supabase integration injects. It is a
 *     session-mode connection, which Prisma supports (transaction-mode poolers on :6543 do not fit Prisma's
 *     prepared statements without pgbouncer=true).
 * Nuvio lives in its own Postgres schema (default "nuvio") so it never collides with other apps' tables in `public`.
 */
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const raw = env.DATABASE_URL || env.POSTGRES_URL_NON_POOLING;
  if (!raw) return undefined;
  const url = new URL(raw);
  const schema = env.DB_SCHEMA || 'nuvio';
  if (!url.searchParams.has('schema')) url.searchParams.set('schema', schema);
  // Serverless: one connection per function instance, or the pooler's client cap is exhausted quickly.
  if (env.VERCEL && !url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '1');
  return url.toString();
}
