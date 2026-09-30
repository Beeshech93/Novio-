'use client';
import { useRef, useState } from 'react';
import { api } from '@/lib/api';

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX = 5 * 1024 * 1024;

/** Uploads straight to S3 with a presigned POST from the API, then reports the public URL. */
export function ImageUpload({ purpose, label, disabled, onDone }: { purpose: 'logo' | 'product' | 'gallery' | 'service'; label: string; disabled?: boolean; onDone: (publicUrl: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pick(file?: File) {
    if (!file) return;
    setError('');
    if (!TYPES.includes(file.type)) return setError('Usa una imagen JPG, PNG, WebP o GIF');
    if (file.size > MAX) return setError('La imagen debe pesar menos de 5 MB');
    setBusy(true);
    try {
      const p = await api<{ url: string; fields: Record<string, string>; publicUrl: string }>('/uploads/presign', { method: 'POST', body: JSON.stringify({ purpose, contentType: file.type }) });
      const form = new FormData();
      Object.entries(p.fields).forEach(([k, v]) => form.append(k, v));
      form.append('file', file); // must be the last field
      const res = await fetch(p.url, { method: 'POST', body: form });
      if (!res.ok) throw new Error('No se pudo subir la imagen');
      onDone(p.publicUrl);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); if (input.current) input.current.value = ''; }
  }

  return (
    <div>
      <input ref={input} type="file" accept={TYPES.join(',')} hidden onChange={(e) => pick(e.target.files?.[0])} />
      <button type="button" disabled={busy || disabled} onClick={() => input.current?.click()} className="btn !px-3 !py-2 text-sm disabled:opacity-50">{busy ? 'Subiendo…' : label}</button>
      {disabled && <p className="mt-1 text-xs text-slate-500">Requiere la API y el almacenamiento conectados.</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
