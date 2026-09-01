'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchSummary } from './api';
import { POLL_INTERVAL_MS } from './config';
import type { MetricsSummary } from './types';

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
 * Keeps the previous snapshot on screen while a refresh is in flight so the
 * dashboard never flashes empty, and aborts the outstanding request when the
 * interval or window changes.
 */
export const useMetrics = (
  windowSeconds: number,
  intervalMs: number = POLL_INTERVAL_MS,
): UseMetricsResult => {
  const [data, setData] = useState<MetricsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const summary = await fetchSummary(windowSeconds, controller.signal);
      setData(summary);
      setError(null);
      setLastUpdated(Date.now());
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : 'Failed to load metrics');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [windowSeconds]);

  useEffect(() => {
    void load();
    if (intervalMs <= 0) return undefined; // paused

    const timer = setInterval(() => void load(), intervalMs);
    return () => {
      clearInterval(timer);
      controllerRef.current?.abort();
    };
  }, [load, intervalMs]);

  return { data, error, loading, lastUpdated, refresh: () => void load() };
};

export default useMetrics;
