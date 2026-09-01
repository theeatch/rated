'use client';

import { Sparkline } from './Sparkline';

interface StatTileProps {
  label: string;
  value: string;
  /** Optional qualifier under the value — units, denominator, or state word. */
  detail?: string;
  /** Small colored mark that carries identity; text stays in text tokens. */
  markColor?: string;
  trend?: number[];
  trendColor?: string;
}

export function StatTile({ label, value, detail, markColor, trend, trendColor }: StatTileProps) {
  return (
    <div className="card flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {markColor ? <span className="swatch" style={{ background: markColor }} aria-hidden /> : null}
          <span className="card-subtitle">{label}</span>
        </div>
        {/* Proportional figures — tabular-nums is for aligned columns only. */}
        <div className="metric-value mt-1.5">{value}</div>
        {detail ? (
          <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {detail}
          </div>
        ) : null}
      </div>

      {trend && trend.length > 1 ? (
        <Sparkline values={trend} color={trendColor || markColor || 'var(--text-muted)'} />
      ) : null}
    </div>
  );
}

export default StatTile;
