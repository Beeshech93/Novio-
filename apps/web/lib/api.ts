// Browser: NEXT_PUBLIC_API_URL. In production it defaults to the relative "/api/v1", which the Next rewrite
// forwards to API_ORIGIN (same origin => first-party session cookie, no CORS).
// Server (SSR / ISR): call the API origin directly, since a relative URL has no host there.
const PUBLIC_URL = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? '/api/v1' : 'http://localhost:4000/api/v1');
export const API_URL = typeof window === 'undefined' && process.env.API_ORIGIN ? `${process.env.API_ORIGIN.replace(/\/$/, '')}/api/v1` : PUBLIC_URL;

/** `network`: the request never got an answer. `status >= 500`: the server answered but is unavailable. */
export class ApiError extends Error {
  constructor(message: string, readonly status = 0, readonly network = false) { super(message); }
  /** True when the API is unreachable/unavailable (as opposed to rejecting the request). */
  get unavailable() { return this.network || this.status >= 500; }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init.headers } });
  } catch {
    throw new ApiError('No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.', 0, true);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // 503 from our own API carries a deliberate, user-safe message (e.g. "Nuvio AI no está conectada"); other 5xx are generic.
    if (res.status >= 500) throw new ApiError(res.status === 503 && typeof body.message === 'string' ? body.message : 'El servicio no está disponible por ahora. Inténtalo de nuevo en unos minutos.', res.status);
    const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new ApiError(msg ?? 'Algo salió mal', res.status);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

/**
 * Server-side fetch for public pages (SSR/ISR/build). NEVER throws: on a network error, a non-2xx status or a
 * non-JSON body (e.g. a platform login page) it returns `fallback`, so a broken API can't fail a build or a page.
 */
export async function fetchJsonSafe<T>(path: string, fallback: T, revalidate = 60): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate }, redirect: 'manual' });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}
