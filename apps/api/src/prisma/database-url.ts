/**
 * Resolves the Postgres URL used at runtime.
 *  - Default: DATABASE_URL (Neon/Vercel integrations inject it), else POSTGRES_URL_NON_POOLING.
 *  - DB_SCHEMA set (Nuvio living in its own schema of a shared database): Prisma applies the schema with a
 *    session-level `SET search_path`, which a transaction-mode pooler (PgBouncer, "-pooler" hosts) does not keep
 *    between queries. So in that case prefer the DIRECT connection (DATABASE_URL_UNPOOLED / POSTGRES_URL_NON_POOLING).
 *  - Pooled endpoints used without a schema need pgbouncer=true so Prisma avoids prepared statements.
 */
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const raw = env.DB_SCHEMA
    ? env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL
    : env.DATABASE_URL || env.POSTGRES_URL_NON_POOLING;
  if (!raw) return undefined;
  const url = new URL(raw);
  if (env.DB_SCHEMA && !url.searchParams.has('schema')) url.searchParams.set('schema', env.DB_SCHEMA);
  if (url.hostname.includes('-pooler') && !url.searchParams.has('pgbouncer')) url.searchParams.set('pgbouncer', 'true');
  // Serverless: one connection per function instance, or the database's connection cap is exhausted quickly.
  if (env.VERCEL && !url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '1');
  return url.toString();
}
