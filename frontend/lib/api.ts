import type { MetricsSummary, Policy, ProbeResult } from './types';
import { PUBLIC_API_BASE_URL } from './config';

/**
 * Dashboard reads go through the Next route handler at /api/proxy, which
 * attaches the dashboard key and admin token server-side. The browser never
 * sees a credential.
 */
const proxy = (path: string) => `/api/proxy${path}`;

const json = async <T,>(response: Response): Promise<T> => {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
};

export const fetchSummary = async (windowSeconds: number, signal?: AbortSignal) =>
  json<MetricsSummary>(
    await fetch(proxy(`/metrics?window=${windowSeconds}&events=25`), {
      signal,
      cache: 'no-store',
    }),
  );

export const fetchPolicies = async (signal?: AbortSignal) =>
  json<{ policies: Policy[] }>(await fetch(proxy('/policies'), { signal, cache: 'no-store' }));

export const updatePolicy = async (name: string, patch: Partial<Policy>) =>
  json<{ policy: Policy }>(
    await fetch(proxy(`/policies/${name}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  );

export const resetPolicy = async (name: string) =>
  json<{ policy: Policy }>(await fetch(proxy(`/policies/${name}/reset`), { method: 'POST' }));

export const resetMetrics = async () =>
  json<{ status: string; keysRemoved: number }>(
    await fetch(proxy('/metrics/reset'), { method: 'POST' }),
  );

/**
 * Fires one request straight at the backend — not through the proxy — so the
 * bucket is keyed on the viewer's own IP and the X-RateLimit-* headers arrive
 * exactly as a real client would see them.
 */
export const probe = async (
  path: string,
  method: string,
  apiKey?: string,
): Promise<ProbeResult> => {
  const startedAt = performance.now();
  const url = `${PUBLIC_API_BASE_URL}${path}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify({ username: 'demo' }) } : {}),
    });

    const num = (header: string) => {
      const raw = response.headers.get(header);
      return raw === null ? null : Number(raw);
    };

    return {
      at: Date.now(),
      path,
      status: response.status,
      allowed: response.status !== 429,
      policy: response.headers.get('x-ratelimit-policy'),
      limit: num('x-ratelimit-limit'),
      remaining: num('x-ratelimit-remaining'),
      retryAfter: num('retry-after'),
      durationMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    return {
      at: Date.now(),
      path,
      status: 0,
      allowed: false,
      policy: null,
      limit: null,
      remaining: null,
      retryAfter: null,
      durationMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : 'network error',
    };
  }
};
