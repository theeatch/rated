import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const load = (file) => readFileSync(join(here, file), 'utf8');

/**
 * Script definitions registered on the ioredis client as custom commands.
 * ioredis handles EVALSHA + NOSCRIPT fallback for us, so the script body is
 * only shipped to Redis once per connection.
 */
export const scripts = {
  tokenBucket: { numberOfKeys: 4, lua: load('token_bucket.lua') },
  peekBucket: { numberOfKeys: 1, lua: load('peek_bucket.lua') },
};

export const registerScripts = (client) => {
  for (const [name, definition] of Object.entries(scripts)) {
    if (typeof client[name] !== 'function') {
      client.defineCommand(name, definition);
    }
  }
  return client;
};

export default registerScripts;
