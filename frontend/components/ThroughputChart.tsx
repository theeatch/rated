'use client';

import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useChartColors } from '@/lib/colors';
import { axisTick, clockTime } from '@/lib/format';
import type { SeriesPoint } from '@/lib/types';

/**
 * Request throughput over time: allowed and blocked requests per second.
 *
 * Both series are rates on one shared axis — never a second y-scale. They are
 * drawn from a common baseline rather than stacked so each can be read
 * directly, with blocked on top since it is usually the smaller series.
 */
export function ThroughputChart({ series }: { series: SeriesPoint[] }) {
  const colors = useChartColors();
  const [showTable, setShowTable] = useState(false);

  const latest = series[series.length - 1];
  const peak = series.reduce((max, point) => Math.max(max, point.total), 0);

  return (
    <section className="card" aria-label="Request throughput">
      <header className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="card-title">Request throughput</h2>
          <p className="card-subtitle">Requests per second, sampled every second</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Legend — always present for two or more series. */}
          <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            <span className="flex items-center gap-1.5">
              <span className="swatch" style={{ background: colors.allowed }} aria-hidden />
              Allowed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="swatch" style={{ background: colors.blocked }} aria-hidden />
              Blocked
            </span>
          </div>

          <button
            type="button"
            className="btn"
            onClick={() => setShowTable((value) => !value)}
            aria-pressed={showTable}
          >
            {showTable ? 'Chart' : 'Table'}
          </button>
        </div>
      </header>

      {showTable ? (
        <div className="max-h-[260px] overflow-y-auto">
          <table className="data-table tabular">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Allowed/s</th>
                <th scope="col">Blocked/s</th>
                <th scope="col">Total/s</th>
              </tr>
            </thead>
            <tbody>
              {[...series]
                .reverse()
                .slice(0, 60)
                .map((point) => (
                  <tr key={point.second}>
                    <td>{clockTime(point.timestamp)}</td>
                    <td>{point.allowed}</td>
                    <td>{point.blocked}</td>
                    <td>{point.total}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 12, right: 16, bottom: 0, left: -12 }}>
              <defs>
                {/* Area fill is a ~10% wash of the series hue, never a block. */}
                <linearGradient id="fill-allowed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.allowed} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={colors.allowed} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="fill-blocked" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.blocked} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={colors.blocked} stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke={colors.grid} strokeWidth={1} vertical={false} />

              <XAxis
                dataKey="timestamp"
                tickFormatter={clockTime}
                stroke={colors.axis}
                tick={{ fill: colors.muted, fontSize: 11 }}
                tickLine={false}
                minTickGap={48}
              />
              <YAxis
                stroke={colors.axis}
                tick={{ fill: colors.muted, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={axisTick}
                width={48}
                allowDecimals={false}
              />

              <Tooltip
                cursor={{ stroke: colors.axis, strokeWidth: 1 }}
                content={<ThroughputTooltip allowedColor={colors.allowed} blockedColor={colors.blocked} />}
              />

              <Area
                type="monotone"
                dataKey="allowed"
                name="Allowed"
                stroke={colors.allowed}
                strokeWidth={2}
                fill="url(#fill-allowed)"
                isAnimationActive={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: colors.surface }}
              />
              <Area
                type="monotone"
                dataKey="blocked"
                name="Blocked"
                stroke={colors.blocked}
                strokeWidth={2}
                fill="url(#fill-blocked)"
                isAnimationActive={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: colors.surface }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <footer
        className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] tabular"
        style={{ color: 'var(--text-muted)' }}
      >
        <span>Now {latest ? latest.total : 0} req/s</span>
        <span>Peak {peak} req/s</span>
        <span>Window {series.length}s</span>
      </footer>
    </section>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number; payload?: SeriesPoint }[];
  allowedColor: string;
  blockedColor: string;
}

function ThroughputTooltip({ active, payload, allowedColor, blockedColor }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const rows = [
    { label: 'Allowed', value: point.allowed, color: allowedColor },
    { label: 'Blocked', value: point.blocked, color: blockedColor },
  ];

  return (
    <div
      className="rounded-lg px-2.5 py-2 text-[11px] shadow-sm"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
    >
      <div className="mb-1 font-medium" style={{ color: 'var(--text-primary)' }}>
        {clockTime(point.timestamp)}
      </div>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
          <span className="swatch" style={{ background: row.color }} aria-hidden />
          <span className="min-w-14">{row.label}</span>
          <span className="tabular font-medium" style={{ color: 'var(--text-primary)' }}>
            {row.value}/s
          </span>
        </div>
      ))}
    </div>
  );
}

export default ThroughputChart;
