import assert from 'node:assert/strict';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import test from 'node:test';
import { consumeJtiOnce, decryptAndValidateLaunchToken } from './token.mjs';

const TEST_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef';

function mintTestToken(payload) {
  const key = createHash('sha256').update(TEST_SECRET, 'utf8').digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

test('decryptAndValidateLaunchToken validates fresh encrypted payload', () => {
  const exp = Math.floor(Date.now() / 1000) + 60;
  const token = mintTestToken({
    v: 1,
    jti: 'jti-123',
    exp,
    sessionId: 'sess-1',
    connection: { type: 'rdp', settings: { hostname: '10.0.0.15', port: 3389 } },
  });

  const decoded = decryptAndValidateLaunchToken({ token, secret: TEST_SECRET });
  assert.equal(decoded.jti, 'jti-123');
  assert.equal(decoded.connection.type, 'rdp');
  assert.equal(decoded.connection.settings.hostname, '10.0.0.15');
});

test('decryptAndValidateLaunchToken rejects tampered or expired tokens', () => {
  const expiredToken = mintTestToken({
    v: 1,
    jti: 'jti-old',
    exp: Math.floor(Date.now() / 1000) - 5,
    sessionId: 'sess-1',
    connection: { type: 'vnc', settings: { hostname: '10.0.0.20', port: 5900 } },
  });

  assert.throws(
    () => decryptAndValidateLaunchToken({ token: expiredToken, secret: TEST_SECRET }),
    /expired/i
  );

  const tampered = `${expiredToken.slice(0, -4)}AAAA`;
  assert.throws(() => decryptAndValidateLaunchToken({ token: tampered, secret: TEST_SECRET }));
});

test('consumeJtiOnce prevents replay of the same launch token JTI', async () => {
  const memoryCache = new Map();
  const expSeconds = Math.floor(Date.now() / 1000) + 60;

  await consumeJtiOnce({ jti: 'jti-once', expSeconds, redisClient: null, memoryCache });
  await assert.rejects(
    () => consumeJtiOnce({ jti: 'jti-once', expSeconds, redisClient: null, memoryCache }),
    /already consumed/i
  );
});
