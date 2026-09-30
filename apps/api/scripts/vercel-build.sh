#!/bin/sh
# Vercel build for the API. On PRODUCTION builds only, prepare the database first:
#  - create the dedicated schema when DB_SCHEMA is set (Nuvio sharing a database with another app)
#  - prisma migrate deploy: applies pending migrations (idempotent; refuses a non-empty target with no migration history)
#  - seed: upserts the 3 plans (never overwrites prices an admin already changed)
# Uses the direct (non-pooled) connection, because migrations need session-level features that PgBouncer lacks.
# Previews don't touch the database, so an unreviewed branch can't alter production data.
set -e
if [ "$VERCEL_ENV" = "production" ]; then
  DB="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-$DATABASE_URL}}"
  if [ -n "$DB" ]; then
    if [ -n "$DB_SCHEMA" ]; then
      case "$DB_SCHEMA" in *[!a-z0-9_]*|"") echo "DB_SCHEMA must match [a-z0-9_]+"; exit 1;; esac
      echo "==> Ensuring schema \"$DB_SCHEMA\""
      echo "CREATE SCHEMA IF NOT EXISTS \"$DB_SCHEMA\";" | DATABASE_URL="$DB" prisma db execute --stdin --schema prisma/schema.prisma
      case "$DB" in *\?*) DB="$DB&schema=$DB_SCHEMA";; *) DB="$DB?schema=$DB_SCHEMA";; esac
    fi
    echo "==> Applying database migrations"
    DATABASE_URL="$DB" prisma migrate deploy
    echo "==> Seeding plans"
    DATABASE_URL="$DB" ts-node prisma/seed.ts
  else
    echo "==> No database URL at build time: skipping migrations"
  fi
fi
nest build
