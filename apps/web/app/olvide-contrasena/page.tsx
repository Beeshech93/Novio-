'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Logo } from '@/components/Logo';
import { api } from '@/lib/api';

export default function Olvide() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: new FormData(e.currentTarget).get('email') }) });
      setSent(true);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Logo />
      <div className="card mt-8 space-y-4">
        <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
        {sent ? (
          <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Si ese correo tiene una cuenta, te enviamos un enlace para cambiar tu contraseña. Revisa tu bandeja (y spam). El enlace dura 1 hora.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-slate-600">Escribe tu correo y te enviaremos un enlace.</p>
            <input name="email" type="email" required placeholder="Correo" className="input" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={busy} className="btn btn-primary w-full">{busy ? 'Enviando…' : 'Enviar enlace'}</button>
          </form>
        )}
        <p className="text-center text-sm"><Link href="/login" className="font-semibold text-brand">Volver a iniciar sesión</Link></p>
      </div>
    </main>
  );
}
