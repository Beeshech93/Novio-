'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';

const NAV: [string, string | null][] = [
  ['Inicio', '/dashboard'], ['Ventas', null], ['Pedidos', null], ['Productos', '/dashboard/productos'], ['Inventario', '/dashboard/productos'],
  ['Clientes', '/dashboard/clientes'], ['CRM', '/dashboard/clientes'], ['Citas', '/dashboard/citas'], ['Mi página', '/dashboard/mi-pagina'], ['WhatsApp', null],
  ['Facturación', null], ['Pagos', null], ['Marketing', null], ['Automatizaciones', null], ['Analytics', null], ['Configuración', null],
];

export function DashShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-4 md:block">
        <Logo />
        <nav className="mt-6 space-y-1 text-sm">
          {NAV.map(([label, href]) =>
            href ? (
              <Link key={label} href={href} className={`block rounded-lg px-3 py-2 ${path === href ? 'bg-brand/10 font-semibold text-brand' : 'text-slate-700 hover:bg-slate-100'}`}>{label}</Link>
            ) : (
              <div key={label} className="rounded-lg px-3 py-2 text-slate-400" title="Próximamente">{label}</div>
            ),
          )}
        </nav>
      </aside>
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
