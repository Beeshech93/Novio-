import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="text-2xl font-extrabold tracking-tight">
      <span className="bg-gradient-to-r from-brand to-mint bg-clip-text text-transparent">Nuvio</span>
    </Link>
  );
}
