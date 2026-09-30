# @nuvio/api

NestJS API (Prisma + PostgreSQL). Swagger at `/api/docs`, health at `/api/v1/health` and `/api/v1/health/ready`.

Production builds on Vercel run `scripts/vercel-build.sh`: migrations, plan seed, and `ADMIN_EMAIL` promotion
(the user must have registered first; redeploy after registering). See `docs/DEPLOY.md`.
