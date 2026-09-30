import { NextRequest, NextResponse } from 'next/server';

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'nuvio.app';
const APP_HOSTS = new Set(['www', 'app', 'admin']);

/**
 * negocio.nuvio.app -> /sitio/negocio ; custom domains (www.negocio.com) -> /sitio/www.negocio.com
 * Apex/app/admin/localhost/*.vercel.app keep the normal routes.
 */
export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').split(':')[0].toLowerCase();
  if (!host || host === ROOT || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.vercel.app')) return NextResponse.next();
  const path = req.nextUrl.pathname;
  if (path.startsWith('/sitio/') || path.startsWith('/_next') || path.startsWith('/api/')) return NextResponse.next();

  const label = host.endsWith(`.${ROOT}`) ? host.slice(0, -(ROOT.length + 1)) : host;
  if (APP_HOSTS.has(label)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `/sitio/${label}${req.nextUrl.pathname === '/' ? '' : req.nextUrl.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
