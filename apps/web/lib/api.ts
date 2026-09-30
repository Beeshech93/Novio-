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
    if (res.status >= 500) throw new ApiError('El servicio no está disponible por ahora. Inténtalo de nuevo en unos minutos.', res.status);
    const body = await res.json().catch(() => ({}));
    const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new ApiError(msg ?? 'Algo salió mal', res.status);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
