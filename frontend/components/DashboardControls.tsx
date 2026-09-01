'use client';

import { useState } from 'react';

import { resetMetrics } from '@/lib/api';
import { POLL_OPTIONS, WINDOW_OPTIONS } from '@/lib/config';
import { clockTime } from '@/lib/format';

/** Filters and actions sit in one row above the charts, never between them. */
export function DashboardControls({
  pollMs,
  onPollChange,
  windowSeconds,
  onWindowChange,
  lastUpdated,
  onRefresh,
}: {
  pollMs: number;
  onPollChange: (value: number) => void;
  windowSeconds: number;
  onWindowChange: (value: number) => void;
  lastUpdated: number | null;
  onRefresh: () => void;
}) {
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleReset = async () => {
    if (!window.confirm('Clear all recorded counters and history? Live buckets are untouched.')) {
      return;
    }
    setResetting(true);
    setMessage(null);
    try {
      const result = await resetMetrics();
      setMessage(`Cleared ${result.keysRemoved} keys`);
      onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Refresh
        <select
          className="control"
          value={pollMs}
          onChange={(event) => onPollChange(Number(event.target.value))}
        >
          {POLL_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        History
        <select
          className="control"
          value={windowSeconds}
          onChange={(event) => onWindowChange(Number(event.target.value))}
        >
          {WINDOW_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button type="button" className="btn" onClick={onRefresh}>
        Refresh now
      </button>

      <button type="button" className="btn" onClick={() => void handleReset()} disabled={resetting}>
        Reset counters
      </button>

      <div className="ml-auto text-[11px] tabular" style={{ color: 'var(--text-muted)' }}>
        {message ? `${message} · ` : ''}
        {lastUpdated ? `Updated ${clockTime(lastUpdated)}` : 'Waiting for data…'}
      </div>
    </div>
  );
}

export default DashboardControls;
