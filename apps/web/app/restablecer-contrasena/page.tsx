'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { Logo } from '@/components/Logo';
import { api } from '@/lib/api';

function Form() {
  const token = useSearchParams().get('token') ?? '';
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get('password') !== f.get('confirm')) return setError('Las contraseñas no coinciden');
    setBusy(true); setError('');
    try { await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password: f.get('password') }) }); setDone(true); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  if (!token) return <p className="text-sm text-red-600">El enlace no es válido. <Link href="/olvide-contrasena" className="font-semibold underline">Pide uno nuevo</Link>.</p>;
  if (done) return <div className="space-y-3"><p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Listo, cambiamos tu contraseña. Por seguridad cerramos tus otras sesiones.</p><Link href="/login" className="btn btn-primary w-full">Iniciar sesión</Link></div>;
  return (
    <form onSubmit={submit} className="space-y-4">
      <input name="password" type="password" required minLength={8} maxLength={72} placeholder="Nueva contraseña (mín. 8)" className="input" autoComplete="new-password" />
      <input name="confirm" type="password" required minLength={8} placeholder="Repite la contraseña" className="input" autoComplete="new-password" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={busy} className="btn btn-primary w-full">{busy ? 'Guardando…' : 'Cambiar contraseña'}</button>
    </form>
  );
}

export default function Restablecer() {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Logo />
      <div className="card mt-8 space-y-4"><h1 className="text-2xl font-bold">Nueva contraseña</h1><Suspense fallback={null}><Form /></Suspense></div>
    </main>
  );
}
