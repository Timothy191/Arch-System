const fs = require('fs');
const file = 'packages/redis/src/client.ts';
let code = fs.readFileSync(file, 'utf8');

const replacement = `export async function getRedisClient(): Promise<RedisClientType> {
  if (client?.isOpen) return client;
  if (connecting) return connecting;

  // Short-circuit on Vercel if no valid Redis URL is provided.
  // Avoids hanging for 15 seconds (3 retries * 5s timeout) on every edge function cold start.
  if (process.env.VERCEL === '1' && REDIS_URL.includes('localhost')) {
    // Return a dummy client or throw. The cache functions handle null/throw gracefully.
    throw new Error('Redis is not configured in this Vercel environment.');
  }

  connecting = (async () => {`;

code = code.replace(
  `export async function getRedisClient(): Promise<RedisClientType> {\n  if (client?.isOpen) return client;\n  if (connecting) return connecting;\n\n  connecting = (async () => {`,
  replacement
);

fs.writeFileSync(file, code);
