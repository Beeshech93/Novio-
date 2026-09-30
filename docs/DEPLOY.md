# Despliegue de Nuvio

Nada se conecta solo: cada servicio externo se activa poniendo sus variables (ver `.env.example`).

## Arquitectura de producción
| Pieza | Dónde | Notas |
|---|---|---|
| Web (Next.js) | Vercel (ya enlazado a este repo, raíz `apps/web`) o Docker | `NEXT_PUBLIC_API_URL` apunta a la API |
| API (NestJS) | Docker (Render/Railway/Fly/VPS) | `apps/api/Dockerfile`, salud en `/api/v1/health` |
| Base de datos | PostgreSQL **propia de Nuvio** | no mezclar con otras apps |
| Redis | opcional por ahora | los recordatorios usan cron, no cola |

## 0. Configuración actual en Vercel (equipo WISHEBEE)
Dos proyectos enlazados a este repo:
| Proyecto | Raíz | Rol |
|---|---|---|
| `nuvio` | `apps/web` | Next.js. Llama a la API por **el mismo dominio**: `/api/v1/*` se reenvía a la API con un rewrite (así la cookie de sesión es propia y no hay CORS). |
| `nuvio-api` | `apps/api` | NestJS. |

Variables del proyecto **nuvio-api** (Settings → Environment Variables): `DATABASE_URL`, `JWT_SECRET` (`openssl rand -hex 32`), `WEB_ORIGIN` (URL de la web), `TRUST_PROXY_HOPS` (default 1), `CRON_SECRET`, `TWOFA_ENCRYPTION_KEY`, y las de cada servicio externo (ver `.env.example`).
Variables del proyecto **nuvio** (web): `API_ORIGIN=https://nuvio-api.vercel.app` (sin `/api/v1`) y `NEXT_PUBLIC_API_URL=/api/v1`. Redepliega la web después de cambiarlas.
**Protección de despliegues:** en `nuvio-api` la URL de producción `https://nuvio-api.vercel.app` es pública (verificado: responde sin pedir login), pero las URLs por despliegue (`nuvio-api-wishebee.vercel.app`, previews) piden *Vercel Authentication*. Usa siempre `https://nuvio-api.vercel.app` como `API_ORIGIN`.

## 1. Base de datos
1. Crea una base vacía y copia su `DATABASE_URL`.
2. La API aplica migraciones al arrancar si `RUN_MIGRATIONS=1` (o a mano: `npx prisma migrate deploy --schema apps/api/prisma/schema.prisma`).
3. Seed (planes + admin): `ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run seed -w @nuvio/api` (contraseña de 12+ caracteres).

## 2. API
```bash
docker build -f apps/api/Dockerfile -t nuvio-api .
docker run -p 4000:4000 -e DATABASE_URL=… -e JWT_SECRET=$(openssl rand -hex 32) \
  -e WEB_ORIGIN=https://app.nuvio.app -e RUN_MIGRATIONS=1 nuvio-api
```
- Obligatorias: `DATABASE_URL`, `JWT_SECRET` (16+), `WEB_ORIGIN` (CORS; varios separados por coma).
- En producción el proveedor de pruebas está desactivado: sin proveedor de cobros real, los pagos en línea responden 501.
- Render: `deploy/render.yaml` es un blueprint listo.
- Recordatorios y automatizaciones: programa `POST /api/v1/internal/cron/reminders` con la cabecera `x-cron-secret` (= `CRON_SECRET`) cada 15–60 min.

## 3. Web
- **Vercel** (actual): variable `NEXT_PUBLIC_API_URL=https://api.tudominio.com/api/v1`, y redepliega (se incrusta en el build).
- **Docker**: `docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=… -t nuvio-web .`

## 4. Dominios
- `nuvio.app` (landing), `app.` y `admin.` → la web. Los subdominios de negocios `negocio.nuvio.app` se enrutan por `middleware.ts`.
- En Vercel agrega el dominio `*.nuvio.app` (DNS comodín, requiere nameservers de Vercel para el certificado comodín).
- Dominios propios de clientes (`www.negocio.com`): agrégalos al proyecto y guarda el valor en `websites.customDomain`.
- Define `NEXT_PUBLIC_ROOT_DOMAIN` si tu dominio raíz no es `nuvio.app`.

## 5. Checklist antes de abrir al público
- [ ] `TWOFA_ENCRYPTION_KEY` definida y respaldada.
- [ ] `JWT_SECRET` largo y aleatorio; HTTPS en todo; `NODE_ENV=production`.
- [ ] Backups automáticos de Postgres y prueba de restauración.
- [ ] Proveedor de cobros real registrado + secretos de webhook.
- [ ] Resend (`RESEND_API_KEY`, `EMAIL_FROM`) y, si usas WhatsApp, plantillas `nuvio_*` aprobadas.
- [ ] `CRON_SECRET` y el programador configurados.
- [ ] Alertas sobre `/api/v1/health/ready`.
- [ ] Rotar cualquier credencial que se haya compartido por chat o correo.

## Verificado y no verificado
Verificado: los pasos del Dockerfile de la API (instalar, generar Prisma, compilar, podar, arrancar Nest) y el build *standalone* de la web, ejecutados a mano. **No verificado**: `docker build` en sí (no había Docker disponible al escribirlo); revísalo en tu primera construcción.
