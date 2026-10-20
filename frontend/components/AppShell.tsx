'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { href: '/', label: 'Overview' },
  { href: '/policies', label: 'Policies' },
  { href: '/playground', label: 'Playground' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-10 border-b-2"
        style={{ borderColor: 'var(--rule)', background: 'var(--plane)' }}
      >
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-6 px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              className="tabular grid h-7 w-7 place-items-center text-[14px] font-bold"
              style={{ background: 'var(--text-primary)', color: 'var(--on-ink)' }}
              aria-hidden
            >
              R
            </span>
            <span className="text-[17px] font-bold tracking-tight">RateFlow</span>
          </Link>

          <nav className="flex items-center gap-5" aria-label="Sections">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className="border-b-2 py-1 text-[14px] font-medium"
                  style={{
                    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                    borderColor: active ? 'var(--accent)' : 'transparent',
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-5 py-6">{children}</main>

      <footer className="label mx-auto max-w-[1400px] px-5 pb-8 pt-2">
        RateFlow — distributed token-bucket rate limiting on Redis.
      </footer>
    </div>
  );
}

export default AppShell;
