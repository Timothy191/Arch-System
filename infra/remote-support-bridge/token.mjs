import { createDecipheriv, createHash } from 'node:crypto';

const AES_ALGORITHM = 'aes-256-gcm';
const MIN_SECRET_LENGTH = 32;
const TOKEN_VERSION = 1;

function deriveKey(secret) {
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`REMOTE_DESKTOP_TOKEN_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  return createHash('sha256').update(secret, 'utf8').digest();
}

/**
 * Decrypts and validates a single-use AES-256-GCM Tier 2 launch token minted by
 * apps/portal/features/remote-support/lib/tier2-token.ts.
 */
export function decryptAndValidateLaunchToken({ token, secret, nowMs = Date.now() }) {
  if (!token || typeof token !== 'string') {
    throw new Error('Missing launch token');
  }

  const key = deriveKey(secret);
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed launch token');
  }

  const [ivPart, tagPart, dataPart] = parts;
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error('Incomplete launch token');
  }

  const iv = Buffer.from(ivPart, 'base64url');
  const authTag = Buffer.from(tagPart, 'base64url');
  const encrypted = Buffer.from(dataPart, 'base64url');

  const decipher = createDecipheriv(AES_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  const payload = JSON.parse(decrypted.toString('utf8'));

  if (
    payload.v !== TOKEN_VERSION ||
    !payload.jti ||
    !payload.sessionId ||
    !payload.connection?.type ||
    !payload.connection?.settings?.hostname
  ) {
    throw new Error('Invalid launch token payload');
  }

  const nowSeconds = Math.floor(nowMs / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
    throw new Error('Launch token expired');
  }

  return payload;
}

/**
 * Enforces single-use consumption of a token JTI via Redis (when configured)
 * or an in-memory replay guard with bounded pruning.
 */
export async function consumeJtiOnce({ jti, expSeconds, redisClient, memoryCache }) {
  const key = `support:t2:jti:${jti}`;
  if (redisClient) {
    const existing = await redisClient.get(key);
    if (existing === 'used') {
      throw new Error('Launch token already consumed');
    }
    const ttl = Math.max(30, expSeconds - Math.floor(Date.now() / 1000) + 30);
    await redisClient.set(key, 'used', 'EX', ttl);
    return;
  }

  const now = Date.now();
  for (const [entryJti, expiresAtMs] of memoryCache.entries()) {
    if (expiresAtMs <= now) {
      memoryCache.delete(entryJti);
    }
  }
  if (memoryCache.has(jti)) {
    throw new Error('Launch token already consumed');
  }
  memoryCache.set(jti, expSeconds * 1000);
}
