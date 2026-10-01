import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { APIError } from '@/lib/errors/error-classes';

/**
 * Application-side secret encryption for integration credentials.
 *
 * AES-256-GCM with a key derived from INTEGRATION_ENCRYPTION_KEY via scrypt.
 * Ciphertext layout (base64): 12-byte iv | 16-byte tag | payload. A fresh IV is
 * drawn per encryption, which is the required GCM discipline for a single key.
 *
 * The database only ever stores this ciphertext, so a database dump alone
 * cannot recover connector API keys. Rotation = re-encrypt on credential update.
 */

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new APIError(
      'INTEGRATION_ENCRYPTION_KEY is missing or too short (>= 16 chars required)',
      { statusCode: 500, context: { component: 'integration_crypto' } }
    );
  }
  cachedKey = scryptSync(secret, 'arch-integrations-v1', 32);
  return cachedKey;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', loadKey(), iv);
  const payload = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, payload]).toString('base64');
}

export function decryptSecret(ciphertext: string): string {
  const raw = Buffer.from(ciphertext, 'base64');
  if (raw.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new APIError('Integration credential ciphertext is malformed', {
      statusCode: 500,
      context: { component: 'integration_crypto' },
    });
  }
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const payload = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', loadKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload), decipher.final()]).toString('utf8');
}
