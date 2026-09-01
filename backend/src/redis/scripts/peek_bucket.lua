--[[
  Read-only bucket inspection for the dashboard.

  Applies the same lazy-refill maths as token_bucket.lua so the UI shows the
  tokens a request would actually see, but never mutates state — polling the
  dashboard must not perturb the system it is observing.

  KEYS[1] bucket hash
  ARGV[1] capacity
  ARGV[2] refillRate
  ARGV[3] now (unix milliseconds)

  Returns { tokensRemaining, updatedAt, ttlSeconds, exists }
--]]

local capacity   = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now        = tonumber(ARGV[3])

local state     = redis.call('HMGET', KEYS[1], 'tokens', 'updatedAt')
local tokens    = tonumber(state[1])
local updatedAt = tonumber(state[2])

if tokens == nil or updatedAt == nil then
  return { tostring(capacity), '0', -2, 0 }
end

local elapsed = now - updatedAt
if elapsed < 0 then elapsed = 0 end
tokens = math.min(capacity, tokens + (elapsed * refillRate) / 1000.0)

local ttl = redis.call('TTL', KEYS[1])

return { tostring(tokens), tostring(updatedAt), ttl, 1 }
