// Browser: NEXT_PUBLIC_API_URL (use the relative "/api/v1" in production so requests go through the Next rewrite).
// Server (SSR / ISR): call the API origin directly, since a relative URL has no host there.
const PUBLIC_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
export const API_URL = typeof window === 'undefined' && process.env.API_ORIGIN ? `${process.env.API_ORIGIN.replace(/\/$/, '')}/api/v1` : PUBLIC_URL;

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(msg ?? 'Algo salió mal');
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
