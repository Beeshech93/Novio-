import Link from 'next/link';
import { Logo } from '@/components/Logo';

const features = [
  ['🌐', 'Página web', 'Tu página profesional en minutos, en negocio.nuvio.app.'],
  ['🛒', 'Vende online', 'Catálogo, pedidos y checkout listos para vender.'],
  ['💳', 'Cobra a tus clientes', 'Tarjeta, transferencia y links de pago.'],
  ['👥', 'Clientes y productos', 'CRM e inventario sin complicaciones.'],
  ['📅', 'Citas', 'Agenda, disponibilidad y recordatorios.'],
  ['⚡', 'Automatiza', 'WhatsApp, campañas y tareas en piloto automático.'],
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4">
      <header className="flex items-center justify-between py-5">
        <Logo />
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/precios">Precios</Link>
          <Link href="/login">Iniciar sesión</Link>
        </nav>
      </header>

      <section className="py-16 text-center">
        <h1 className="text-5xl font-extrabold leading-tight tracking-tight sm:text-7xl">
          Haz crecer <span className="bg-gradient-to-r from-brand to-mint bg-clip-text text-transparent">tu negocio.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Todo lo que necesitas para digitalizar, administrar, vender y hacer crecer tu negocio desde un solo lugar.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/registro" className="btn btn-primary">Crear mi negocio gratis</Link>
          <Link href="/precios" className="btn">Ver planes</Link>
        </div>
      </section>

      <section className="grid gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(([icon, title, text]) => (
          <div key={title} className="card">
            <div className="text-3xl">{icon}</div>
            <h3 className="mt-2 font-bold">{title}</h3>
            <p className="text-sm text-slate-600">{text}</p>
          </div>
        ))}
      </section>

      <section className="pb-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Tu negocio. Una plataforma. Más crecimiento.</h2>
      </section>
    </main>
  );
}
