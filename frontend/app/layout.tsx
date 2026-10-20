import type { Metadata } from 'next';
import { Azeret_Mono, Schibsted_Grotesk } from 'next/font/google';

import { AppShell } from '@/components/AppShell';

import './globals.css';

/**
 * Schibsted Grotesk sets prose, headings and navigation; Azeret Mono sets
 * every figure, label and table. Both are self-hosted by next/font at build
 * time. The variable names are aliased to --font-sans / --font-mono in
 * app/globals.css.
 */
const sans = Schibsted_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-schibsted',
});

const mono = Azeret_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-azeret',
});

export const metadata: Metadata = {
  title: 'RateFlow — rate limiting control plane',
  description:
    'Real-time monitoring for a distributed Redis token-bucket rate limiter: throughput, token utilization, blocked requests and Redis state.',
};

/**
 * Applies the stored theme before first paint so a dark-mode reload never
 * flashes the light surface.
 */
const themeBootstrap = `(function(){try{var t=localStorage.getItem('rateflow-theme');if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
