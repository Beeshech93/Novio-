import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteRenderer } from '@/components/SiteRenderer';
import { DEMOS, TEMPLATES } from '@/lib/site';

export function generateStaticParams() { return TEMPLATES.map((t) => ({ template: t.slug })); }

export default function Demo({ params }: { params: { template: string } }) {
  const site = DEMOS[params.template];
  if (!site) notFound();
  return (
    <>
      <nav className="sticky top-0 z-20 flex gap-2 overflow-x-auto bg-slate-900 px-3 py-2 text-xs text-white">
        <Link href="/" className="shrink-0 font-bold">← Nuvio</Link>
        {TEMPLATES.map((t) => (
          <Link key={t.slug} href={`/demo/${t.slug}`} className={`shrink-0 rounded-full px-3 py-1 ${t.slug === params.template ? 'bg-white text-slate-900' : 'bg-white/10'}`}>{t.emoji} {t.name}</Link>
        ))}
      </nav>
      <SiteRenderer site={site} />
    </>
  );
}
