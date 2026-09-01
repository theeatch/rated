/** Shapes returned by the RateFlow backend (`GET /api/metrics`). */

export type PolicyScope = 'ip' | 'apiKey' | 'user' | 'global';

export interface Policy {
  name: string;
  description: string;
  capacity: number;
  refillRate: number;
  cost: number;
  scope: PolicyScope;
  overridden?: boolean;
}

export interface Counts {
  allowed: number;
  blocked: number;
  total: number;
  blockRate: number;
}

export interface PolicyCounts extends Counts {
  policy: string;
}

export interface SeriesPoint {
  second: number;
  timestamp: number;
  allowed: number;
  blocked: number;
  total: number;
}

export interface Throughput {
  requestsPerSecond: number;
  allowedPerSecond: number;
  blockedPerSecond: number;
  windowSeconds?: number;
}

export interface BucketState {
  policy: string;
  identity: string;
  capacity: number;
  refillRate: number;
  remaining: number;
  used: number;
  /** 0–1 share of the burst budget currently spent. */
  utilization: number;
  updatedAt: number | null;
  ttlSeconds: number;
}

export interface Utilization {
  activeBuckets: number;
  truncated: boolean;
  overall: { capacity: number; used: number; utilization: number };
  byPolicy: {
    policy: string;
    buckets: number;
    capacity: number;
    used: number;
    utilization: number;
  }[];
  topBuckets: BucketState[];
}

export interface RedisState {
  connected: boolean;
  error: string | null;
  latencyMs: number | null;
  server: { version: string | null; mode: string; uptimeSeconds: number | null } | null;
  memory: {
    usedBytes: number | null;
    usedHuman: string | null;
    peakBytes: number | null;
    fragmentationRatio: number | null;
  } | null;
  stats: {
    opsPerSecond: number | null;
    totalCommands: number | null;
    totalConnections: number | null;
    keyspaceHits: number | null;
    keyspaceMisses: number | null;
    connectedClients: number | null;
  } | null;
  keyspace: { keys: number } | null;
}

export interface RequestEvent {
  at: number;
  policy: string;
  identity: string;
  route: string;
  allowed: boolean;
  remaining: number;
  limit: number;
}

export interface MetricsSummary {
  generatedAt: number;
  windowSeconds: number;
  throughput: Throughput;
  totals: Counts;
  byPolicy: PolicyCounts[];
  utilization: Utilization;
  series: SeriesPoint[];
  events: RequestEvent[];
  redis: RedisState;
  policies: Policy[];
  config: { failureMode: 'open' | 'closed'; defaultPolicy: string; bucketTtlSeconds: number };
}

/** Result of one simulated request in the traffic playground. */
export interface ProbeResult {
  at: number;
  path: string;
  status: number;
  allowed: boolean;
  policy: string | null;
  limit: number | null;
  remaining: number | null;
  retryAfter: number | null;
  durationMs: number;
  error?: string;
}
