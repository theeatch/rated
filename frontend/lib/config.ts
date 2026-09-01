/** Browser-visible configuration. Anything secret stays behind /api/proxy. */

export const PUBLIC_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:4000';

export const POLL_INTERVAL_MS = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS) || 2000;

/** Poll intervals offered in the dashboard header. */
export const POLL_OPTIONS = [
  { label: '1s', value: 1000 },
  { label: '2s', value: 2000 },
  { label: '5s', value: 5000 },
  { label: 'Paused', value: 0 },
];

/** Trailing history the throughput chart requests, in seconds. */
export const WINDOW_OPTIONS = [
  { label: '60s', value: 60 },
  { label: '2m', value: 120 },
  { label: '5m', value: 300 },
];

/** Endpoints the traffic playground can hit, with the policy guarding each. */
export const DEMO_ENDPOINTS = [
  { path: '/api/demo/ping', method: 'GET', policy: 'default', label: 'Ping' },
  { path: '/api/demo/search?q=rateflow', method: 'GET', policy: 'burst', label: 'Search' },
  { path: '/api/demo/report', method: 'GET', policy: 'strict', label: 'Report (cost 5)' },
  { path: '/api/demo/login', method: 'POST', policy: 'auth', label: 'Login' },
  { path: '/api/demo/partner/feed', method: 'GET', policy: 'partner', label: 'Partner feed' },
] as const;
