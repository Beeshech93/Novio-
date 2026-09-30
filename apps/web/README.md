# @nuvio/web

Next.js storefront, public business sites and dashboard.

- `API_ORIGIN` (server): origin of the Nuvio API. `/api/v1/*` is proxied to it by a rewrite in `next.config.js`.
- `NEXT_PUBLIC_API_URL`: use `/api/v1` in production so the browser talks to the web domain (first-party cookies).
- Local dev: `npm run dev -w @nuvio/web` (API at http://localhost:4000).
- Vercel project settings: Framework Preset = Next.js, Root Directory = apps/web.
