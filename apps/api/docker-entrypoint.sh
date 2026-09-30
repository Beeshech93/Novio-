#!/bin/sh
set -e
# Applies pending migrations before boot when RUN_MIGRATIONS=1 (safe to run on every deploy; it's idempotent).
if [ "$RUN_MIGRATIONS" = "1" ]; then
  node node_modules/prisma/build/index.js migrate deploy --schema apps/api/prisma/schema.prisma
fi
exec "$@"
