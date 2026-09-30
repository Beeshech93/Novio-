import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteRenderer } from '@/components/SiteRenderer';
import { API_URL } from '@/lib/api';
import { PublicSite } from '@/lib/site';

async function load(host: string): Promise<PublicSite | null> {
  try {
    const res = await fetch(`${API_URL}/public/sites/${encodeURIComponent(host)}`, { next: { revalidate: 30 } });
    return res.ok ? res.json() : null;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: { host: string } }): Promise<Metadata> {
  const s = await load(params.host);
  return s ? { title: s.content.title || s.name, description: s.content.tagline } : { title: 'Sitio no encontrado' };
}

export default async function Sitio({ params }: { params: { host: string } }) {
  const site = await load(params.host);
  if (!site) notFound();
  return <SiteRenderer site={site} host={params.host} />;
}
