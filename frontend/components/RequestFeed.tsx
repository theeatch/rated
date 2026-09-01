'use client';

import { useChartColors } from '@/lib/colors';
import { clockTime, shortIdentity } from '@/lib/format';
import type { RequestEvent } from '@/lib/types';

/** Rolling log of the most recent limiter decisions. */
export function RequestFeed({ events }: { events: RequestEvent[] }) {
  const colors = useChartColors();

  return (
    <section className="card" aria-label="Recent decisions">
      <header className="mb-2">
        <h2 className="card-title">Recent decisions</h2>
        <p className="card-subtitle">Newest first, capped at the last 200 requests</p>
      </header>

      {events.length === 0 ? (
        <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
          Nothing yet.
        </p>
      ) : (
        <div className="max-h-[280px] overflow-y-auto">
          <table className="data-table tabular">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Result</th>
                <th scope="col">Policy</th>
                <th scope="col">Identity</th>
                <th scope="col">Left</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, index) => (
                <tr key={`${event.at}-${index}`}>
                  <td>{clockTime(event.at)}</td>
                  <td>
                    {/* Colored mark beside the word — never the word in color. */}
                    <span className="flex items-center gap-1.5">
                      <span
                        className="swatch"
                        style={{ background: event.allowed ? colors.allowed : colors.blocked }}
                        aria-hidden
                      />
                      <span style={{ color: 'var(--text-primary)' }}>
                        {event.allowed ? 'Allowed' : 'Blocked'}
                      </span>
                    </span>
                  </td>
                  <td>{event.policy}</td>
                  <td title={event.identity}>{shortIdentity(event.identity, 18)}</td>
                  <td>
                    {Math.max(0, Math.floor(event.remaining))}/{event.limit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default RequestFeed;
