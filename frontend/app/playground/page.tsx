'use client';

import { useState } from 'react';

import { ThroughputChart } from '@/components/ThroughputChart';
import { TokenUtilizationPanel } from '@/components/TokenUtilizationPanel';
import { TrafficSimulator } from '@/components/TrafficSimulator';
import { useMetrics } from '@/lib/useMetrics';

export default function PlaygroundPage() {
  const [windowSeconds] = useState(60);
  // The traffic table updates live on its own; the charts only need the shared,
  // server-cached summary, so a slow poll is enough (and keeps Redis usage low).
  const { data } = useMetrics(windowSeconds, 5000);

  return (
    <>
      <header className="mb-4">
        <h1 className="text-[18px] font-semibold">Playground</h1>
        <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
          Drive traffic at the protected endpoints and watch the token bucket drain, block, and
          refill in real time.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <TrafficSimulator />
        {data ? <ThroughputChart series={data.series} /> : null}
      </div>

      {data ? (
        <div className="mt-4">
          <TokenUtilizationPanel utilization={data.utilization} />
        </div>
      ) : null}
    </>
  );
}
