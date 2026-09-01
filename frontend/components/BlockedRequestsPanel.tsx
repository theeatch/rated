'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useChartColors } from '@/lib/colors';
import { axisTick, compact, percent } from '@/lib/format';
import type { PolicyCounts } from '@/lib/types';

/**
 * Blocked requests per policy — a single series, so no legend box: the title
 * says what is plotted. Bars are capped at 24px with a 4px rounded data-end.
 */
export function BlockedRequestsPanel({ byPolicy }: { byPolicy: PolicyCounts[] }) {
  const colors = useChartColors();

  const data = [...byPolicy]
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.blocked - a.blocked);

  const worst = data.reduce<PolicyCounts | null>(
    (max, entry) => (!max || entry.blockRate > max.blockRate ? entry : max),
    null,
  );

  return (
    <section className="card" aria-label="Blocked requests by policy">
      <header className="mb-2">
        <h2 className="card-title">Blocked requests by policy</h2>
        <p className="card-subtitle">
          {worst
            ? `Highest block rate: ${worst.policy} at ${percent(worst.blockRate, 1)}`
            : 'No traffic recorded yet'}
        </p>
      </header>

      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -12 }} barCategoryGap="28%">
              <CartesianGrid stroke={colors.grid} strokeWidth={1} vertical={false} />
              <XAxis
                dataKey="policy"
                stroke={colors.axis}
                tick={{ fill: colors.muted, fontSize: 11 }}
                tickLine={false}
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
              <Tooltip cursor={{ fill: 'transparent' }} content={<BlockedTooltip />} />
              <Bar
                dataKey="blocked"
                name="Blocked"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                isAnimationActive={false}
              >
                {data.map((entry) => (
                  <Cell key={entry.policy} fill={colors.blocked} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <table className="data-table tabular mt-3">
        <thead>
          <tr>
            <th scope="col">Policy</th>
            <th scope="col">Allowed</th>
            <th scope="col">Blocked</th>
            <th scope="col">Block rate</th>
          </tr>
        </thead>
        <tbody>
          {byPolicy.map((entry) => (
            <tr key={entry.policy}>
              <td style={{ color: 'var(--text-primary)' }}>{entry.policy}</td>
              <td>{compact(entry.allowed)}</td>
              <td>{compact(entry.blocked)}</td>
              <td>{percent(entry.blockRate, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function EmptyState() {
  return (
    <div
      className="grid h-[200px] place-items-center rounded-lg text-[12px]"
      style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
    >
      Send traffic from the Playground to populate this chart.
    </div>
  );
}

function BlockedTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: PolicyCounts }[];
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload;
  if (!entry) return null;

  return (
    <div
      className="rounded-lg px-2.5 py-2 text-[11px]"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
    >
      <div className="mb-1 font-medium" style={{ color: 'var(--text-primary)' }}>
        {entry.policy}
      </div>
      <div className="tabular" style={{ color: 'var(--text-secondary)' }}>
        {compact(entry.blocked)} blocked of {compact(entry.total)} · {percent(entry.blockRate, 1)}
      </div>
    </div>
  );
}

export default BlockedRequestsPanel;
