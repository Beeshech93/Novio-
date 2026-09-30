'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Logo } from '@/components/Logo';
import { api } from '@/lib/api';

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError('');
    try {
      if (challenge) {
        await api('/auth/2fa/login', { method: 'POST', body: JSON.stringify({ challenge, code: f.get('code') }) });
        router.push('/dashboard');
        return;
      }
      const r = await api<{ twoFactorRequired?: boolean; challenge?: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email: f.get('email'), password: f.get('password') }) });
      if (r.twoFactorRequired && r.challenge) { setChallenge(r.challenge); return; }
      router.push('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Logo />
      <form onSubmit={submit} className="card mt-8 space-y-4">
        <h1 className="text-2xl font-bold">Iniciar sesión</h1>
        {challenge ? (
          <>
            <p className="text-sm text-slate-600">Escribe el código de 6 dígitos de tu app autenticadora, o un código de recuperación.</p>
            <input name="code" required autoFocus autoComplete="one-time-code" inputMode="text" placeholder="123456" className="input tracking-widest" />
          </>
        ) : (
          <>
            <input name="email" type="email" required placeholder="Correo" className="input" />
            <input name="password" type="password" required placeholder="Contraseña" className="input" />
          </>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="btn btn-primary w-full">{busy ? 'Entrando…' : challenge ? 'Verificar' : 'Entrar'}</button>
        <p className="text-center text-sm"><Link href="/olvide-contrasena" className="font-semibold text-brand">¿Olvidaste tu contraseña?</Link></p>
        <p className="text-center text-sm text-slate-600">¿Sin cuenta? <Link href="/registro" className="font-semibold text-brand">Crea tu negocio</Link></p>
      </form>
    </main>
  );
}
