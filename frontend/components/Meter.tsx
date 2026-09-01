'use client';

import { useChartColors, utilizationColor, utilizationLabel } from '@/lib/colors';
import { percent } from '@/lib/format';

/**
 * Horizontal utilization meter.
 *
 * The fill carries severity (accent → warning → critical); the track is a
 * lighter step of the fill's own ramp, so the state reads across the whole
 * bar. The numeric value and the state word are always printed — severity is
 * never color-alone.
 */
export function Meter({
  label,
  detail,
  ratio,
  showState = true,
}: {
  label: string;
  detail?: string;
  ratio: number;
  showState?: boolean;
}) {
  const colors = useChartColors();
  const clamped = Math.max(0, Math.min(1, ratio));
  const fill = utilizationColor(clamped, colors);

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-[12px]" style={{ color: 'var(--text-primary)' }}>
          {label}
        </span>
        <span className="tabular text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>
          {percent(clamped)}
        </span>
      </div>

      <div
        className="meter-track"
        style={{ ['--meter-fill' as string]: fill }}
        role="meter"
        aria-valuenow={Math.round(clamped * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} token utilization`}
      >
        <div className="meter-fill" style={{ width: `${clamped * 100}%` }} />
      </div>

      {(detail || showState) && (
        <div className="mt-1 flex justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span>{detail}</span>
          {showState ? <span>{utilizationLabel(clamped)}</span> : null}
        </div>
      )}
    </div>
  );
}

export default Meter;
