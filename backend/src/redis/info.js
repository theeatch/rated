import { getRedis, isRedisReady, getRedisError } from './client.js';

/** Turns the `INFO` bulk string into a flat object. */
export const parseInfo = (raw) => {
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf(':');
    if (index === -1) continue;
    out[line.slice(0, index)] = line.slice(index + 1);
  }
  return out;
};

const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Snapshot of Redis health for the dashboard's "Redis state" panel.
 * Never throws — a degraded Redis should still render, just marked offline.
 */
export const getRedisSnapshot = async () => {
  if (!isRedisReady()) {
    return {
      connected: false,
      error: getRedisError() || 'not connected',
      server: null,
      memory: null,
      stats: null,
      keyspace: null,
      latencyMs: null,
    };
  }

  const redis = getRedis();
  const startedAt = Date.now();

  try {
    const [rawServer, rawMemory, rawStats, rawClients, rawKeyspace] = await Promise.all([
      redis.info('server'),
      redis.info('memory'),
      redis.info('stats'),
      redis.info('clients'),
      redis.info('keyspace'),
    ]);
    const latencyMs = Date.now() - startedAt;

    const server = parseInfo(rawServer);
    const memory = parseInfo(rawMemory);
    const stats = parseInfo(rawStats);
    const clients = parseInfo(rawClients);
    const keyspace = parseInfo(rawKeyspace);

    const dbLine = keyspace[`db${redis.options.db ?? 0}`] || '';
    const keyCount = num(dbLine.match(/keys=(\d+)/)?.[1]) ?? 0;

    return {
      connected: true,
      error: null,
      latencyMs,
      server: {
        version: server.redis_version ?? null,
        mode: server.redis_mode ?? 'standalone',
        uptimeSeconds: num(server.uptime_in_seconds),
      },
      memory: {
        usedBytes: num(memory.used_memory),
        usedHuman: memory.used_memory_human ?? null,
        peakBytes: num(memory.used_memory_peak),
        fragmentationRatio: num(memory.mem_fragmentation_ratio),
      },
      stats: {
        opsPerSecond: num(stats.instantaneous_ops_per_sec),
        totalCommands: num(stats.total_commands_processed),
        totalConnections: num(stats.total_connections_received),
        keyspaceHits: num(stats.keyspace_hits),
        keyspaceMisses: num(stats.keyspace_misses),
        connectedClients: num(clients.connected_clients),
      },
      keyspace: { keys: keyCount },
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
      server: null,
      memory: null,
      stats: null,
      keyspace: null,
      latencyMs: null,
    };
  }
};

export default getRedisSnapshot;
