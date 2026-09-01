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
        className="sticky top-0 z-10 border-b backdrop-blur"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in oklab, var(--plane) 88%, transparent)',
        }}
      >
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-4 px-5 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span
              className="grid h-7 w-7 place-items-center rounded-md text-[13px] font-bold text-white"
              style={{ background: 'var(--series-allowed)' }}
              aria-hidden
            >
              R
            </span>
            <span className="text-[15px] font-semibold tracking-tight">RateFlow</span>
          </Link>

          <nav className="flex items-center gap-1" aria-label="Sections">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className="rounded-md px-2.5 py-1 text-[13px] transition-colors"
                  style={{
                    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                    background: active
                      ? 'color-mix(in oklab, var(--text-primary) 7%, transparent)'
                      : 'transparent',
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

      <footer
        className="mx-auto max-w-[1400px] px-5 pb-8 pt-2 text-[11px]"
        style={{ color: 'var(--text-muted)' }}
      >
        RateFlow — distributed token-bucket rate limiting on Redis.
      </footer>
    </div>
  );
}

export default AppShell;
