'use client';

import { Meter } from './Meter';
import { compact, percent, shortIdentity } from '@/lib/format';
import type { Utilization } from '@/lib/types';

/**
 * Token utilization — how much of each bucket's burst budget is currently
 * spent. Meters rather than a chart: each row is one magnitude against its own
 * fixed capacity, which is exactly what a meter is for.
 */
export function TokenUtilizationPanel({ utilization }: { utilization: Utilization }) {
  const { overall, byPolicy, topBuckets, activeBuckets, truncated } = utilization;

  return (
    <section className="card" aria-label="Token utilization">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="card-title">Token utilization</h2>
          <p className="card-subtitle">
            Share of each bucket&rsquo;s burst budget currently consumed
          </p>
        </div>
        <span className="chip tabular">
          {activeBuckets} active bucket{activeBuckets === 1 ? '' : 's'}
          {truncated ? ' (capped)' : ''}
        </span>
      </header>

      <div className="mb-4">
        <Meter
          label="All buckets"
          ratio={overall.utilization}
          detail={`${compact(overall.used)} of ${compact(overall.capacity)} tokens spent`}
        />
      </div>

      {byPolicy.length === 0 ? (
        <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
          No buckets have been created yet — send traffic from the Playground.
        </p>
      ) : (
        <div className="grid gap-3">
          {byPolicy
            .slice()
            .sort((a, b) => b.utilization - a.utilization)
            .map((entry) => (
              <Meter
                key={entry.policy}
                label={entry.policy}
                ratio={entry.utilization}
                detail={`${entry.buckets} bucket${entry.buckets === 1 ? '' : 's'} · ${compact(
                  entry.used,
                )}/${compact(entry.capacity)} tokens`}
              />
            ))}
        </div>
      )}

      {topBuckets.length > 0 ? (
        <div className="mt-4">
          <h3 className="mb-1 text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            Most drained buckets
          </h3>
          <table className="data-table tabular">
            <thead>
              <tr>
                <th scope="col">Identity</th>
                <th scope="col">Policy</th>
                <th scope="col">Remaining</th>
                <th scope="col">Used</th>
              </tr>
            </thead>
            <tbody>
              {topBuckets.slice(0, 6).map((bucket) => (
                <tr key={`${bucket.policy}:${bucket.identity}`}>
                  <td style={{ color: 'var(--text-primary)' }} title={bucket.identity}>
                    {shortIdentity(bucket.identity)}
                  </td>
                  <td>{bucket.policy}</td>
                  <td>
                    {compact(bucket.remaining)}/{compact(bucket.capacity)}
                  </td>
                  <td>{percent(bucket.utilization)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export default TokenUtilizationPanel;
