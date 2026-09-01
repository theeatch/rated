import type { Metadata } from 'next';

import { AppShell } from '@/components/AppShell';

import './globals.css';

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
