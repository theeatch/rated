'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchSummary } from './api';
import { POLL_INTERVAL_MS } from './config';
import type { MetricsSummary } from './types';

/**
 * A request still pending after this long is treated as hung and replaced by
 * the next poll. Anything younger is left alone so a slow backend can finish.
 */
const STALE_REQUEST_MS = 30_000;

interface UseMetricsResult {
  data: MetricsSummary | null;
  error: string | null;
  loading: boolean;
  lastUpdated: number | null;
  refresh: () => void;
}

/**
 * Polls the metrics summary on an interval.
 *
 * Polling pauses while the tab is hidden (and refreshes once on return), so a
 * forgotten background tab does not burn through the Redis command budget.
 *
 * Keeps the previous snapshot on screen while a refresh is in flight so the
 * dashboard never flashes empty. A poll tick that lands while a request is
 * still pending is skipped rather than restarting it — otherwise a backend
 * slower than the interval would have every request cancelled by the next
 * one and the first load would never complete. The outstanding request is
 * aborted when the interval or window changes.
 */
export const useMetrics = (
  windowSeconds: number,
  intervalMs: number = POLL_INTERVAL_MS,
): UseMetricsResult => {
  const [data, setData] = useState<MetricsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const inFlightRef = useRef<{ controller: AbortController; startedAt: number } | null>(null);

  const load = useCallback(async () => {
    const pending = inFlightRef.current;
    if (pending && Date.now() - pending.startedAt < STALE_REQUEST_MS) return;
    pending?.controller.abort();

    const controller = new AbortController();
    inFlightRef.current = { controller, startedAt: Date.now() };

    try {
      const summary = await fetchSummary(windowSeconds, controller.signal);
      setData(summary);
      setError(null);
      setLastUpdated(Date.now());
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : 'Failed to load metrics');
    } finally {
      if (inFlightRef.current?.controller === controller) inFlightRef.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [windowSeconds]);

  useEffect(() => {
    void load();
    if (intervalMs <= 0) return undefined; // paused

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      inFlightRef.current?.controller.abort();
      inFlightRef.current = null;
    };
  }, [load, intervalMs]);

  return { data, error, loading, lastUpdated, refresh: () => void load() };
};

export default useMetrics;
