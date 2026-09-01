'use client';

import { StatusPill } from './StatusPill';
import { bytes, compact, duration } from '@/lib/format';
import type { RedisState } from '@/lib/types';

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-3 py-1">
    <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
      {label}
    </span>
    <span className="tabular text-[12px]" style={{ color: 'var(--text-primary)' }}>
      {value}
    </span>
  </div>
);

/** Live view of the Redis instance backing every bucket. */
export function RedisStatePanel({
  redis,
  failureMode,
}: {
  redis: RedisState;
  failureMode: 'open' | 'closed';
}) {
  const hitRate =
    redis.stats && (redis.stats.keyspaceHits ?? 0) + (redis.stats.keyspaceMisses ?? 0) > 0
      ? (redis.stats.keyspaceHits ?? 0) /
        ((redis.stats.keyspaceHits ?? 0) + (redis.stats.keyspaceMisses ?? 0))
      : null;

  return (
    <section className="card" aria-label="Redis state">
      <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="card-title">Redis state</h2>
          <p className="card-subtitle">
            {redis.connected
              ? `${redis.server?.mode ?? 'standalone'} · v${redis.server?.version ?? '—'}`
              : 'Backing store unreachable'}
          </p>
        </div>
        {redis.connected ? (
          <StatusPill tone="good" label="Connected" />
        ) : (
          <StatusPill tone="critical" label="Disconnected" />
        )}
      </header>

      {!redis.connected ? (
        <div
          className="mb-3 rounded-lg px-3 py-2 text-[12px]"
          style={{
            border: '1px solid var(--border)',
            background: 'color-mix(in oklab, var(--status-critical) 8%, var(--surface-1))',
            color: 'var(--text-secondary)',
          }}
        >
          {redis.error || 'No connection'} — limiter is failing{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{failureMode}</strong>, so requests are
          currently being {failureMode === 'open' ? 'allowed through' : 'rejected'}.
        </div>
      ) : null}

      <div>
        <Row label="Command latency" value={redis.latencyMs === null ? '—' : `${redis.latencyMs} ms`} />
        <Row label="Ops / second" value={compact(redis.stats?.opsPerSecond)} />
        <Row label="Connected clients" value={compact(redis.stats?.connectedClients)} />
        <Row label="Keys in keyspace" value={compact(redis.keyspace?.keys)} />
        <Row label="Memory used" value={bytes(redis.memory?.usedBytes)} />
        <Row label="Memory peak" value={bytes(redis.memory?.peakBytes)} />
        <Row
          label="Keyspace hit rate"
          value={hitRate === null ? '—' : `${(hitRate * 100).toFixed(1)}%`}
        />
        <Row label="Total commands" value={compact(redis.stats?.totalCommands)} />
        <Row label="Uptime" value={duration(redis.server?.uptimeSeconds)} />
      </div>
    </section>
  );
}

export default RedisStatePanel;
