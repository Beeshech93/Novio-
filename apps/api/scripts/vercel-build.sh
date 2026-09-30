#!/bin/sh
# Vercel build for the API. On PRODUCTION builds only, prepare the database first:
#  - prisma migrate deploy: applies pending migrations (idempotent; refuses to touch a non-empty DB that has no migration history)
#  - seed: upserts the 3 plans (never overwrites prices an admin already changed)
# Uses the direct (non-pooled) connection, because migrations need session-level features that PgBouncer lacks.
# Previews don't touch the database, so an unreviewed branch can't alter production data.
set -e
if [ "$VERCEL_ENV" = "production" ]; then
  DB="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-$DATABASE_URL}}"
  if [ -n "$DB" ]; then
    echo "==> Applying database migrations"
    DATABASE_URL="$DB" prisma migrate deploy
    echo "==> Seeding plans"
    DATABASE_URL="$DB" ts-node prisma/seed.ts
  else
    echo "==> No database URL at build time: skipping migrations"
  fi
fi
nest build
