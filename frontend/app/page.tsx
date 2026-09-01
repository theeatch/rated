'use client';

import { useState } from 'react';

import { BlockedRequestsPanel } from '@/components/BlockedRequestsPanel';
import { DashboardControls } from '@/components/DashboardControls';
import { RedisStatePanel } from '@/components/RedisStatePanel';
import { RequestFeed } from '@/components/RequestFeed';
import { StatTile } from '@/components/StatTile';
import { ThroughputChart } from '@/components/ThroughputChart';
import { ThroughputHero } from '@/components/ThroughputHero';
import { TokenUtilizationPanel } from '@/components/TokenUtilizationPanel';
import { useChartColors } from '@/lib/colors';
import { POLL_INTERVAL_MS } from '@/lib/config';
import { compact, percent } from '@/lib/format';
import { useMetrics } from '@/lib/useMetrics';

export default function OverviewPage() {
  const [pollMs, setPollMs] = useState(POLL_INTERVAL_MS);
  const [windowSeconds, setWindowSeconds] = useState(120);
  const colors = useChartColors();

  const { data, error, loading, lastUpdated, refresh } = useMetrics(windowSeconds, pollMs);

  if (loading && !data) {
    return <p style={{ color: 'var(--text-muted)' }}>Loading metrics…</p>;
  }

  if (error && !data) {
    return (
      <div className="card" role="alert">
        <h2 className="card-title">Cannot reach the RateFlow API</h2>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
          {error}
        </p>
        <p className="mt-2 text-[12px]" style={{ color: 'var(--text-muted)' }}>
          Check that the backend is running and that <code>BACKEND_URL</code> is set in{' '}
          <code>frontend/.env.local</code>.
        </p>
        <button type="button" className="btn btn-primary mt-3" onClick={refresh}>
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const blockedTrend = data.series.slice(-12).map((point) => point.blocked);
  const allowedTrend = data.series.slice(-12).map((point) => point.allowed);

  return (
    <>
      <DashboardControls
        pollMs={pollMs}
        onPollChange={setPollMs}
        windowSeconds={windowSeconds}
        onWindowChange={setWindowSeconds}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
      />

      {error ? (
        <p className="mb-3 text-[12px]" style={{ color: 'var(--status-critical)' }} role="alert">
          Last refresh failed: {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ThroughputHero
            throughput={data.throughput}
            totals={data.totals}
            series={data.series}
            degraded={!data.redis.connected}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatTile
            label="Allowed requests"
            value={compact(data.totals.allowed)}
            detail="since counters were last reset"
            markColor={colors.allowed}
            trend={allowedTrend}
          />
          <StatTile
            label="Blocked requests"
            value={compact(data.totals.blocked)}
            detail={`${percent(data.totals.blockRate, 1)} of all traffic`}
            markColor={colors.blocked}
            trend={blockedTrend}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ThroughputChart series={data.series} />
        </div>
        <RedisStatePanel redis={data.redis} failureMode={data.config.failureMode} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <TokenUtilizationPanel utilization={data.utilization} />
        <BlockedRequestsPanel byPolicy={data.byPolicy} />
      </div>

      <div className="mt-4">
        <RequestFeed events={data.events} />
      </div>
    </>
  );
}
