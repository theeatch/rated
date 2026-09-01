'use client';

import { Sparkline } from './Sparkline';
import { StatusPill } from './StatusPill';
import { useChartColors } from '@/lib/colors';
import { compact, percent } from '@/lib/format';
import type { Counts, SeriesPoint, Throughput } from '@/lib/types';

/**
 * The one hero figure on the dashboard: current request throughput.
 * Everything else on the page is a supporting tile or chart.
 */
export function ThroughputHero({
  throughput,
  totals,
  series,
  degraded,
}: {
  throughput: Throughput;
  totals: Counts;
  series: SeriesPoint[];
  degraded: boolean;
}) {
  const colors = useChartColors();
  const trend = series.slice(-12).map((point) => point.total);

  const tone =
    totals.blockRate >= 0.25 ? 'critical' : totals.blockRate >= 0.05 ? 'warning' : 'good';
  const label =
    totals.blockRate >= 0.25
      ? 'Heavy shedding'
      : totals.blockRate >= 0.05
        ? 'Shedding traffic'
        : 'Within limits';

  return (
    <section className="card" aria-label="Current throughput">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="card-subtitle">Current throughput</p>
          <p className="hero-value mt-1">{throughput.requestsPerSecond}</p>
          <p className="mt-0.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>
            requests / second · {throughput.windowSeconds ?? 10}s average
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <StatusPill tone={tone} label={label} />
          {degraded ? <StatusPill tone="warning" label="Redis degraded" /> : null}
          <Sparkline values={trend} color={colors.allowed} width={120} height={36} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <Figure
          label="Allowed / s"
          value={String(throughput.allowedPerSecond)}
          markColor={colors.allowed}
        />
        <Figure
          label="Blocked / s"
          value={String(throughput.blockedPerSecond)}
          markColor={colors.blocked}
        />
        <Figure label="Total requests" value={compact(totals.total)} />
        <Figure label="Block rate" value={percent(totals.blockRate, 1)} />
      </div>
    </section>
  );
}

function Figure({
  label,
  value,
  markColor,
}: {
  label: string;
  value: string;
  markColor?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        {markColor ? <span className="swatch" style={{ background: markColor }} aria-hidden /> : null}
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
      </div>
      <div className="text-[18px] font-semibold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

export default ThroughputHero;
