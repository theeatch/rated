'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { probe } from '@/lib/api';
import { DEMO_ENDPOINTS, PUBLIC_API_BASE_URL } from '@/lib/config';
import { useChartColors } from '@/lib/colors';
import { clockTime } from '@/lib/format';
import type { ProbeResult } from '@/lib/types';

const MAX_RESULTS = 60;

/**
 * Fires traffic at the protected demo endpoints so you can watch a bucket
 * drain and refill.
 *
 * Requests go straight to the backend rather than through the Next proxy, so
 * the bucket is keyed on your own IP and the X-RateLimit-* response headers
 * arrive exactly as a real API client would see them.
 */
export function TrafficSimulator({ onTraffic }: { onTraffic?: () => void }) {
  const colors = useChartColors();
  const [endpoint, setEndpoint] = useState<string>(DEMO_ENDPOINTS[0].path);
  const [rate, setRate] = useState(5);
  const [apiKey, setApiKey] = useState('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ProbeResult[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selected = DEMO_ENDPOINTS.find((item) => item.path === endpoint) ?? DEMO_ENDPOINTS[0];

  const fire = useCallback(
    async (count: number) => {
      const batch = await Promise.all(
        Array.from({ length: count }, () => probe(selected.path, selected.method, apiKey || undefined)),
      );
      setResults((current) => [...batch.reverse(), ...current].slice(0, MAX_RESULTS));
      onTraffic?.();
    },
    [selected, apiKey, onTraffic],
  );

  // One batch per second while running; cleared on unmount or setting change.
  useEffect(() => {
    if (!running) return undefined;
    void fire(rate);
    timerRef.current = setInterval(() => void fire(rate), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [running, rate, fire]);

  const allowed = results.filter((result) => result.allowed).length;
  const blocked = results.length - allowed;
  const latest = results[0];

  return (
    <section className="card" aria-label="Traffic generator">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="card-title">Traffic generator</h2>
          <p className="card-subtitle">Requests go directly to {PUBLIC_API_BASE_URL}</p>
        </div>
        <span className="chip">Policy: {selected.policy}</span>
      </header>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Endpoint
          <select
            className="control"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
          >
            {DEMO_ENDPOINTS.map((item) => (
              <option key={item.path} value={item.path}>
                {item.label} — {item.policy}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Requests / second
          <input
            className="control w-24"
            type="number"
            min={1}
            max={100}
            value={rate}
            onChange={(event) => setRate(Math.max(1, Math.min(100, Number(event.target.value) || 1)))}
          />
        </label>

        <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          API key (partner policy)
          <input
            className="control w-40"
            type="text"
            placeholder="optional"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
        </label>

        <button
          type="button"
          className={running ? 'btn' : 'btn btn-primary'}
          onClick={() => setRunning((value) => !value)}
        >
          {running ? 'Stop' : 'Start'}
        </button>

        <button type="button" className="btn" onClick={() => void fire(rate)} disabled={running}>
          Burst {rate}
        </button>

        <button type="button" className="btn" onClick={() => setResults([])} disabled={!results.length}>
          Clear
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <span className="chip tabular">
          <span className="swatch" style={{ background: colors.allowed }} aria-hidden />
          {allowed} allowed
        </span>
        <span className="chip tabular">
          <span className="swatch" style={{ background: colors.blocked }} aria-hidden />
          {blocked} blocked (429)
        </span>
        {latest?.limit !== null && latest?.limit !== undefined ? (
          <span className="chip tabular">
            Tokens left {latest.remaining ?? '—'}/{latest.limit}
          </span>
        ) : null}
        {latest?.retryAfter ? (
          <span className="chip tabular">Retry after {latest.retryAfter}s</span>
        ) : null}
      </div>

      {results.length === 0 ? (
        <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
          Start the generator, then watch the bucket drain on the Overview page.
        </p>
      ) : (
        <div className="max-h-[260px] overflow-y-auto">
          <table className="data-table tabular">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Status</th>
                <th scope="col">Result</th>
                <th scope="col">Tokens left</th>
                <th scope="col">Latency</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, index) => (
                <tr key={`${result.at}-${index}`}>
                  <td>{clockTime(result.at)}</td>
                  <td>{result.status || 'ERR'}</td>
                  <td>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="swatch"
                        style={{ background: result.allowed ? colors.allowed : colors.blocked }}
                        aria-hidden
                      />
                      <span style={{ color: 'var(--text-primary)' }}>
                        {result.error ? 'Error' : result.allowed ? 'Allowed' : 'Blocked'}
                      </span>
                    </span>
                  </td>
                  <td>
                    {result.remaining === null ? '—' : `${result.remaining}/${result.limit ?? '—'}`}
                  </td>
                  <td>{result.durationMs} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default TrafficSimulator;
