# RateFlow

Distributed **token-bucket rate limiting** on Redis, with an interactive dashboard for
watching it work.

RateFlow protects backend APIs from traffic spikes and abuse using configurable
middleware policies and atomic request tracking, and ships a monitoring UI that
visualizes request throughput, token utilization, blocked requests, and Redis state in
real time.

> **Status: skeleton.** Every layer is wired end to end and runs, but all credentials in
> this repo are placeholders (`replace-me-*`) and the protected endpoints under
> `/api/demo/*` are stand-ins. Swap in your own routes and secrets.

---

## Contents

- [Why a token bucket](#why-a-token-bucket)
- [Architecture](#architecture)
- [Project layout](#project-layout)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Policies](#policies)
- [Using the middleware](#using-the-middleware)
- [API reference](#api-reference)
- [The dashboard](#the-dashboard)
- [Design notes](#design-notes)
- [Scaling notes](#scaling-notes)
- [Testing](#testing)
- [Next steps](#next-steps)

---

## Why a token bucket

A fixed window (`N requests per minute`) has a hard edge: a client can spend its whole
budget in the last second of one window and again in the first second of the next,
producing a 2× spike exactly when you were trying to prevent one.

A token bucket has two independent dials:

| Dial | Meaning |
|---|---|
| **capacity** | how big a burst you tolerate |
| **refillRate** | the sustained rate you're willing to serve |

Tokens accrue continuously at `refillRate` up to `capacity`. A request spends `cost`
tokens; if the bucket is short, the request is rejected with a `Retry-After` telling the
client exactly when enough tokens will exist. Bursts are absorbed, sustained abuse is
not.

RateFlow refills **lazily** — a bucket stores only `{ tokens, updatedAt }`, and the
tokens owed since `updatedAt` are computed on access. No background job, no per-client
timers, one hash per identity.

---

## Architecture

```
        browser                    Next.js server               Node API              Redis
  ┌──────────────────┐        ┌────────────────────┐     ┌──────────────────┐   ┌─────────────┐
  │  Dashboard       │──────▶ │ /api/proxy/*       │────▶│ /api/metrics     │──▶│ counters    │
  │  (charts, meters)│  no    │ adds API key +     │     │ /api/policies    │   │ timeseries  │
  │                  │ secrets│ admin token        │     │                  │   │ overrides   │
  │  Traffic gen ────┼────────┼────────────────────┼────▶│ /api/demo/*      │──▶│ buckets     │
  └──────────────────┘ direct └────────────────────┘     │  ratelimiter mw  │   └─────────────┘
                       (real per-IP buckets)             └──────────────────┘      ▲
                                                                   │               │
                                                                   └── EVALSHA ────┘
                                                                    token_bucket.lua
```

**The critical piece is the Lua script.** Refill, the allow/deny decision, and the
counter updates all execute inside one `EVAL` — Redis is single-threaded, so the whole
sequence is atomic. Any number of API nodes can hammer the same bucket and no two
requests will ever spend the same token. Read-modify-write from application code cannot
give you that.

The same script also increments the global, per-policy, and per-second counters, so
**every request the limiter decides is also a request the dashboard counts** — the
metrics can't drift from reality.

Request path:

1. `rateLimiter({ policy })` middleware resolves the effective policy (code definition +
   any runtime override).
2. The bucket identity is derived from the policy's `scope` — IP, API key, user, or global.
3. One `EVALSHA` runs `token_bucket.lua`.
4. `X-RateLimit-*` headers go on the response; blocked requests get `429` + `Retry-After`.
5. The dashboard polls `/api/metrics` for the aggregate view.

If Redis is unreachable, `FAILURE_MODE` decides: `open` keeps serving (availability over
enforcement) or `closed` rejects (enforcement over availability). Either way the response
carries `X-RateLimit-Degraded: true` and the dashboard shows the degraded state.

---

## Project layout

```
RateFlow/
├── frontend/                     Next.js dashboard (App Router, TypeScript)
│   ├── app/
│   │   ├── page.tsx              Overview — throughput, utilization, blocked, Redis
│   │   ├── policies/page.tsx     Policy inspector with live overrides
│   │   ├── playground/page.tsx   Traffic generator
│   │   ├── api/proxy/[...path]/  Server-side proxy that holds the credentials
│   │   ├── layout.tsx
│   │   └── globals.css           Design tokens (light + dark)
│   ├── components/               Charts, meters, tiles, tables
│   └── lib/                      API client, polling hook, palette, formatters
│
├── backend/
│   └── src/
│       ├── config/               Env config + policy definitions
│       ├── controllers/          Health, metrics, policies, demo endpoints
│       ├── middleware/           rateLimiter, auth, logging, errors
│       ├── routes/               Express routers
│       ├── services/             rateLimiter, metrics, buckets, policies
│       ├── redis/                Client, INFO parsing, Lua scripts
│       └── utils/                Keys, logger, errors, time
│
├── docker-compose.yml            redis + backend + frontend
└── README.md
```

---

## Quick start

### With Docker (everything at once)

```bash
cp .env.example .env          # placeholders work as-is for local use
docker compose up --build
```

- Dashboard → <http://localhost:3000>
- API → <http://localhost:4000/api>
- Redis → `localhost:6379`

Open the **Playground**, press **Start**, and watch the bucket drain on the Overview page.

### Without Docker

You need a Redis running locally (`brew install redis && redis-server`, or
`docker run -p 6379:6379 redis:7-alpine`).

```bash
# Terminal 1 — API
cd backend
cp .env.example .env
npm install
npm run dev                   # http://localhost:4000

# Terminal 2 — dashboard
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                   # http://localhost:3000
```

Smoke test the limiter from a shell — the 11th request inside a second is rejected,
because `strict` holds 10 tokens and `/api/demo/report` costs 5:

```bash
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code} " http://localhost:4000/api/demo/ping
done; echo
```

---

## Configuration

Copy `.env.example` → `.env` at the root (compose), `backend/.env.example` → `backend/.env`,
and `frontend/.env.local.example` → `frontend/.env.local`. **Every credential in this
repo is a placeholder.**

### Backend

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `LOG_LEVEL` | `info` | `error` · `warn` · `info` · `debug` |
| `CORS_ORIGIN` | `http://localhost:3000` | Comma-separated allowed origins |
| `REDIS_URL` | — | Full URL; wins over the discrete parts |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379` | Used when no URL is set |
| `REDIS_USERNAME` / `REDIS_PASSWORD` | — | ACL credentials |
| `REDIS_DB` / `REDIS_TLS` | `0` / `false` | Database index, TLS toggle |
| `REDIS_KEY_PREFIX` | `rateflow` | Namespace for every key written |
| `DEFAULT_POLICY` | `default` | Policy for routes that don't name one |
| `FAILURE_MODE` | `open` | Behaviour when Redis is down |
| `BUCKET_TTL_SECONDS` | `3600` | Idle eviction for a bucket |
| `METRICS_WINDOW_SECONDS` | `120` | History the dashboard charts |
| `METRICS_TTL_SECONDS` | `300` | Retention of per-second samples |
| `ADMIN_TOKEN` | `replace-me-…` | Bearer token for mutating endpoints |
| `DASHBOARD_API_KEY` | `replace-me-…` | Key for the read-only metrics API |
| `REQUIRE_API_KEY` | `false` | Enforce the dashboard key |

### Frontend

| Variable | Purpose |
|---|---|
| `BACKEND_URL` | Server-side API base used by `/api/proxy` |
| `DASHBOARD_API_KEY` | Attached by the proxy — never reaches the browser |
| `ADMIN_TOKEN` | Attached by the proxy for mutating calls |
| `ALLOW_ADMIN_PROXY` | `false` makes the proxy refuse mutations |
| `NEXT_PUBLIC_API_BASE_URL` | Browser-visible API base for the traffic generator |
| `NEXT_PUBLIC_POLL_INTERVAL_MS` | Dashboard poll interval |

> `NEXT_PUBLIC_*` values are **inlined at build time**. Under compose they are passed as
> build args; change one and rebuild the frontend image.

---

## Policies

Defined in [`backend/src/config/policies.js`](backend/src/config/policies.js):

| Policy | Capacity | Refill / s | Scope | Intent |
|---|---|---|---|---|
| `default` | 60 | 10 | ip | Baseline for unclassified traffic |
| `strict` | 10 | 1 | ip | Expensive or abuse-prone endpoints |
| `burst` | 200 | 50 | ip | Read-heavy endpoints |
| `auth` | 5 | 0.2 | ip | Credential endpoints — slow refill |
| `partner` | 500 | 100 | apiKey | Per-API-key partner budgets |

`scope` decides the bucket identity: `ip`, `apiKey`, `user`, or `global`.

Policies live in code so they're reviewable in a diff, but the dashboard can override
`capacity` and `refillRate` at runtime. Overrides are stored in Redis, so every API node
picks them up (cached in-process, refreshed every 2s — the hot path never adds a round
trip). **Revert** restores the code definition.

---

## Using the middleware

```js
import { rateLimiter } from './middleware/rateLimiter.middleware.js';

// Named policy
app.get('/api/search', rateLimiter({ policy: 'burst' }), searchHandler);

// Expensive route — one call spends 5 tokens
app.get('/api/report', rateLimiter({ policy: 'strict', cost: 5 }), reportHandler);

// Custom identity: per authenticated user, falling back to IP
app.use(
  '/api/account',
  rateLimiter({
    policy: 'default',
    keyGenerator: (req) => (req.user ? `user:${req.user.id}` : `ip:${req.ip}`),
    skip: (req) => req.user?.role === 'internal',
    onBlocked: (req, res, decision) => metrics.increment('blocked', decision.policy),
  }),
  accountRouter,
);
```

| Option | Type | Purpose |
|---|---|---|
| `policy` | `string` | Policy name; falls back to `DEFAULT_POLICY` |
| `cost` | `number` | Tokens this route spends per request |
| `keyGenerator` | `(req) => string` | Custom bucket identity |
| `skip` | `(req) => boolean` | Bypass the limiter |
| `onBlocked` | `(req, res, decision) => void` | Side effect on rejection |
| `headers` | `boolean` | Emit `X-RateLimit-*` (default `true`) |

Every response carries the decision:

```
X-RateLimit-Policy: strict
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 6            # seconds until the bucket is full again
Retry-After: 2                  # 429 responses only
```

---

## API reference

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health/live` | Process is up (Docker healthcheck) |
| `GET` | `/api/health/ready` | Dependencies usable; `503` when failing closed with Redis down |
| `GET` | `/api/health/redis` | Full Redis `INFO` snapshot |

### Metrics — read-only, guarded by `DASHBOARD_API_KEY` when `REQUIRE_API_KEY=true`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/metrics?window=120&events=25` | Everything the dashboard needs in one call |
| `GET` | `/api/metrics/timeseries?window=120` | Per-second allowed/blocked series |
| `GET` | `/api/metrics/totals` | Lifetime counters, global and per policy |
| `GET` | `/api/metrics/utilization` | Token utilization across live buckets |
| `GET` | `/api/metrics/events?limit=50` | Recent limiter decisions |
| `POST` | `/api/metrics/reset` | Clear counters — **admin token** |

### Policies

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/policies` | Effective policies, with override flags |
| `GET` | `/api/policies/:name` | One policy plus its live buckets |
| `PATCH` | `/api/policies/:name` | Override `capacity` / `refillRate` / `cost` / `scope` — **admin** |
| `POST` | `/api/policies/:name/reset` | Drop the override — **admin** |
| `POST` | `/api/policies/:name/buckets/clear` | Refill one identity's bucket — **admin** |

### Demo endpoints (replace with your own)

| Method | Path | Policy |
|---|---|---|
| `GET` | `/api/demo/ping` | `default` |
| `GET` | `/api/demo/search?q=` | `burst` |
| `GET` | `/api/demo/report` | `strict`, cost 5 |
| `POST` | `/api/demo/login` | `auth` |
| `GET` | `/api/demo/partner/feed` | `partner` (per `x-api-key`) |

---

## The dashboard

**Overview** — the hero figure is current throughput; below it, allowed/blocked
per-second series, token utilization meters per policy, blocked requests by policy, live
Redis state, and a rolling feed of recent decisions.

**Policies** — inspect and override limits live, and see which buckets are most drained.

**Playground** — drive traffic at any protected endpoint at a chosen rate and watch the
`X-RateLimit-*` headers, the 429s, and the refill.

Traffic-generator requests go **straight from the browser to the API**, not through the
Next proxy, so they get real per-client-IP buckets and you see the exact headers a real
client would. Dashboard reads go **through** the proxy, which attaches the API key and
admin token server-side — no credential ever reaches the browser.

---

## Design notes

The charts follow a small set of rules, and the palette was validated rather than
eyeballed:

- **One axis, always.** Allowed and blocked are both req/s on a single scale — no
  dual-axis chart.
- **Validated color.** Allowed uses categorical blue (`#2a78d6` light / `#3987e5` dark);
  blocked uses the reserved status-critical red (`#d03b3b`, identical in both modes).
  Worst-pair colorblind separation is ΔE 23.8 (light) / 25.7 (dark) against a ≥ 8 target,
  with every hue clearing 3:1 contrast on its surface.
- **Never color alone.** Legends are always present for two or more series, status pills
  carry a glyph and a word, and meters print their numeric value and state.
- **Text wears text tokens.** Series colors live on marks — a swatch beside the label —
  never on the label itself.
- **Dark mode is selected, not inverted.** Each mode has its own steps, chosen against
  its own surface. The toggle stamps `data-theme` on `<html>` and wins over the OS
  setting in both directions.
- **Meters, not gauges, for utilization.** Each bucket is one magnitude against its own
  fixed capacity; the fill carries severity (accent → warning → critical) and the track
  is a lighter step of the fill's own ramp.
- **A table view exists** for the throughput chart, so nothing is gated behind color or
  hover.

---

## Scaling notes

- **Redis Cluster.** `token_bucket.lua` touches four keys (bucket, global counters,
  policy counters, per-second sample). In cluster mode all keys in one script must share
  a hash slot. Either pin them with a hash tag (`rateflow:{<identity>}:…`, which shards
  the counters per identity) or split the counters into a separate non-atomic pipeline.
  Single-node and Sentinel work as-is.
- **Metrics cost.** One hash per wall-clock second with a TTL keeps the timeseries cheap
  and self-evicting. Reading a 120s window is one pipeline of 120 `HGETALL`s. For a
  larger fleet, export to Prometheus instead and keep Redis for buckets only.
- **Bucket inventory.** `SCAN` powers the utilization panel and is capped at 500 keys —
  fine for a demo, but with millions of buckets you want a sampled or precomputed
  inventory rather than a scan on every poll.
- **Clock skew.** The script takes `now` from the calling node. Nodes whose clocks drift
  apart will disagree about refill. Keep NTP running, or switch to Redis's own `TIME`
  command inside the script (which makes it non-deterministic — fine on Redis ≥ 5, where
  effect replication is the default).
- **Trust proxy.** `app.set('trust proxy', true)` is on so `req.ip` reflects
  `X-Forwarded-For`. Behind an untrusted edge, narrow that to your proxy's address —
  otherwise a client can forge the header and get its own fresh bucket.

---

## Testing

```bash
cd backend && npm test
```

The suite covers the refill/consume maths with a JS twin of the Lua script — cold
buckets, exhaustion, refill rate, capacity clamping, costly requests, and a burst of
`capacity + 1`. An integration suite that runs the real Lua against a disposable Redis is
the obvious next addition (see the TODO in `backend/test/tokenBucket.test.js`).

---

## Next steps

- [ ] Replace `/api/demo/*` with the real protected routes
- [ ] Replace every `replace-me-*` credential and set `REQUIRE_API_KEY=true`
- [ ] Integration tests against a real Redis
- [ ] Prometheus / OpenTelemetry export alongside the Redis counters
- [ ] Per-identity allowlists and denylists
- [ ] Cluster-safe key tagging (see [Scaling notes](#scaling-notes))
- [ ] Push updates over SSE/WebSocket instead of polling
