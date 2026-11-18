'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Public pages have their own header; every signed-in screen gets this bar.
const PUBLIC = new Set(['/', '/announcements', '/receipt']);

export default function AppBar() {
  const pathname = usePathname() ?? '/';
  if (PUBLIC.has(pathname)) return null;
  return (
    <header className="app-bar">
      <Link className="brand" href="/home" aria-label="Masjid E Mamoor 2, Home">
        <img src="/icon-192.png" alt="" width="30" height="30" />
        <span>Mamoor 2</span>
      </Link>
      {pathname !== '/home' && pathname !== '/login' && (
        <Link className="home-link" href="/home">
          Home
        </Link>
      )}
    </header>
  );
}
