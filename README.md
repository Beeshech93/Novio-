# Nuvio — Haz crecer tu negocio

SaaS multi-tenant todo-en-uno para pequeños negocios. Monorepo: `apps/api` (NestJS + Prisma + PostgreSQL) y `apps/web` (Next.js + Tailwind).

## Estado: Fase 1 (Core)
- Esquema Prisma completo (todas las tablas de la spec, UUID, índices, soft delete) — `apps/api/prisma/schema.prisma`
- Auth: registro (usuario + negocio + membresía OWNER en una transacción), login, logout, `me`; JWT en cookie httpOnly o Bearer; rate limiting
- Aislamiento de tenant: `AuthGuard` solo acepta `x-business-id` si el usuario es miembro; RBAC con `RolesGuard` (`OWNER/MANAGER/EMPLOYEE` + permisos configurables)
- `/api/v1/plans` (precios desde BD, seed en `prisma/seed.ts`), `/businesses`, `/dashboard/summary`; Swagger en `/api/docs`
- Web: landing, precios, login, registro/onboarding (3 pasos), dashboard con sidebar

## Pendiente / decisiones
- Migraciones: aún no generadas (requiere Postgres): `npm run prisma:migrate -w @nuvio/api`
- PostgreSQL RLS: se añadirá en una migración SQL junto a Fase 2 (hoy el aislamiento es a nivel aplicación)
- Tablas `roles`/`permissions` de la spec: se modelaron como enum `MemberRole` + `permissions[]` en `business_members`
- Verificación de email, recuperación de contraseña, 2FA, Redis/BullMQ: pendientes

## Desarrollo
```bash
cp .env.example .env
docker compose up -d
npm install
npx prisma migrate dev --schema apps/api/prisma/schema.prisma
npm run seed -w @nuvio/api
npm run dev:api   # http://localhost:4000/api/docs
npm run dev:web   # http://localhost:3000
npm test
```

## Conexiones manuales (pendientes a propósito)
Nada de esto está conectado; lo configura el administrador:
1. **Base de datos**: define `DATABASE_URL` (una base propia de Nuvio), luego `npx prisma migrate deploy --schema apps/api/prisma/schema.prisma` y `npm run seed -w @nuvio/api`.
2. **Administrador global**: define `ADMIN_EMAIL` y `ADMIN_PASSWORD` (12+ caracteres) antes del seed. Accede a `/api/v1/admin/*` (métricas MRR/ARR/churn, negocios, planes editables, asignar suscripción a mano).
3. **Cobros**: implementa `PaymentProvider` / `BillingProvider` (ver `payments/payment-provider.ts`, `subscriptions/billing-provider.ts`) para Stripe, Mercado Pago o Conekta, regístralo en `app.module.ts` y define `PAYMENT_PROVIDER` / `BILLING_PROVIDER` y sus secretos de webhook. Webhooks: `POST /api/v1/webhooks/payments/:provider` y `/webhooks/billing/:provider`. Mientras tanto, un admin puede activar planes con `POST /admin/businesses/:id/subscription`.
4. **API en producción**: hosting para `apps/api` y `NEXT_PUBLIC_API_URL` en Vercel.

## Fases
1 Core ✅ · 2 Negocio ✅ · 3 Ventas ✅ · 4 Suscripciones ✅ (registro crea prueba de 14 días; funciones por plan validadas en backend con HTTP 402) · 5+ pendientes.
