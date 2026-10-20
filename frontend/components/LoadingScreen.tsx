'use client';

import { useEffect, useState } from 'react';

/** Cells in the bucket graphic. */
const CELLS = 12;

/** What the backend is actually doing for a /metrics call, in order. */
const STAGES = ['Contacting the API', 'Reading Redis state', 'Collecting metrics'];

/** Seconds each stage line stays up — slow on purpose, the wait is not short. */
const STAGE_SECONDS = 3;

/** After this long the copy admits the backend is slower than usual. */
const SLOW_AFTER_SECONDS = 15;

const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * Shown while the backend is still answering its first request.
 *
 * The bucket row is a slow fill-and-drain wave (see `.bucket-cell` in
 * app/globals.css). The stage line and elapsed clock are driven by one
 * one-second timer and are deliberately not tied to real progress: nothing
 * here claims a step finished, it only says what the request is waiting on and
 * for how long.
 */
export function LoadingScreen() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const slow = elapsed >= SLOW_AFTER_SECONDS;
  const stage = STAGES[Math.floor(elapsed / STAGE_SECONDS) % STAGES.length];

  return (
    <section className="grid min-h-[60vh] place-items-center" role="status" aria-live="polite">
      {/* The moving parts are decorative; this is what a screen reader hears. */}
      <span className="sr-only">Loading metrics from the RateFlow API</span>

      <div className="card w-full max-w-xl" aria-hidden>
        <p className="label">RateFlow · Connecting</p>

        <h1 className="page-title mt-3">Warming up the control plane</h1>
        <p className="mt-2 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
          {slow
            ? 'The backend is taking longer than usual to answer — it may still be starting up. Hang tight, this page loads itself as soon as it responds.'
            : 'The backend is still starting up. Hang tight, this page loads itself as soon as it responds.'}
        </p>

        <div className="bucket mt-7">
          {Array.from({ length: CELLS }, (_, index) => (
            <span
              key={index}
              className="bucket-cell"
              style={{ animationDelay: `${index * 0.34}s` }}
            />
          ))}
        </div>

        <div
          className="label tabular mt-4 flex items-center justify-between gap-4 pt-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <span className="flex items-center gap-2">
            <span className="caret" />
            {slow ? 'Still waiting for the API' : stage}
          </span>
          <span>{clock(elapsed)} elapsed</span>
        </div>
      </div>
    </section>
  );
}

export default LoadingScreen;
