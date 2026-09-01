--[[
  Atomic token-bucket consume + request accounting.

  Running the refill, the consume decision and the counter updates inside a
  single Lua script means every API node sees one consistent bucket state:
  concurrent requests can never both read the same token and both be allowed.

  KEYS[1] bucket hash          -> { tokens, updatedAt }
  KEYS[2] global totals hash   -> { allowed, blocked, total }
  KEYS[3] per-policy hash      -> { allowed, blocked, total }
  KEYS[4] per-second hash      -> { allowed, blocked }

  ARGV[1] capacity          (tokens)
  ARGV[2] refillRate        (tokens per second, may be fractional)
  ARGV[3] cost              (tokens consumed by this request)
  ARGV[4] now               (unix milliseconds, supplied by the caller)
  ARGV[5] bucketTtlSeconds  (idle eviction for the bucket)
  ARGV[6] metricsTtlSeconds (retention for the per-second sample)

  Returns { allowed, tokensRemaining, retryAfterMs, resetAfterMs, capacity }
  NOTE: single-node / sentinel deployments only. Under Redis Cluster the four
  keys must share a hash slot — see README "Scaling notes".
--]]

local capacity   = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local cost       = tonumber(ARGV[3])
local now        = tonumber(ARGV[4])
local bucketTtl  = tonumber(ARGV[5])
local metricsTtl = tonumber(ARGV[6])

local state     = redis.call('HMGET', KEYS[1], 'tokens', 'updatedAt')
local tokens    = tonumber(state[1])
local updatedAt = tonumber(state[2])

-- Cold bucket: start full so a new identity gets its full burst allowance.
if tokens == nil or updatedAt == nil then
  tokens = capacity
  updatedAt = now
end

-- Lazy refill: tokens accrue continuously, we only materialise them on access.
local elapsed = now - updatedAt
if elapsed < 0 then elapsed = 0 end
tokens = math.min(capacity, tokens + (elapsed * refillRate) / 1000.0)

local allowed = 0
local retryAfterMs = 0

if tokens >= cost then
  allowed = 1
  tokens = tokens - cost
elseif refillRate > 0 then
  retryAfterMs = math.ceil(((cost - tokens) / refillRate) * 1000)
else
  retryAfterMs = -1 -- never refills
end

redis.call('HSET', KEYS[1], 'tokens', tokens, 'updatedAt', now)
redis.call('EXPIRE', KEYS[1], bucketTtl)

-- Request accounting, committed in the same atomic step as the decision.
local outcome = 'blocked'
if allowed == 1 then outcome = 'allowed' end

redis.call('HINCRBY', KEYS[2], outcome, 1)
redis.call('HINCRBY', KEYS[2], 'total', 1)

redis.call('HINCRBY', KEYS[3], outcome, 1)
redis.call('HINCRBY', KEYS[3], 'total', 1)
redis.call('EXPIRE', KEYS[3], bucketTtl)

redis.call('HINCRBY', KEYS[4], outcome, 1)
redis.call('EXPIRE', KEYS[4], metricsTtl)

-- Time until the bucket is completely refilled, for X-RateLimit-Reset.
local resetAfterMs = 0
if refillRate > 0 then
  resetAfterMs = math.ceil(((capacity - tokens) / refillRate) * 1000)
end

-- Floats must cross the protocol as strings; Lua->Redis truncates numbers.
return { allowed, tostring(tokens), retryAfterMs, resetAfterMs, capacity }
