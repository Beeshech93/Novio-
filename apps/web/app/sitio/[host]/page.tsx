import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteRenderer } from '@/components/SiteRenderer';
import { fetchJsonSafe } from '@/lib/api';
import { PublicSite } from '@/lib/site';

const load = (host: string) => fetchJsonSafe<PublicSite | null>(`/public/sites/${encodeURIComponent(host)}`, null, 30);

export async function generateMetadata({ params }: { params: { host: string } }): Promise<Metadata> {
  const s = await load(params.host);
  return s ? { title: s.content.title || s.name, description: s.content.tagline } : { title: 'Sitio no encontrado' };
}

export default async function Sitio({ params }: { params: { host: string } }) {
  const site = await load(params.host);
  if (!site) notFound();
  return <SiteRenderer site={site} host={params.host} />;
}
