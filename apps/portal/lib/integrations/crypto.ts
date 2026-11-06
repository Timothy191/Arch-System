import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import * as React from 'react';
import { APIError } from '@/lib/errors/error-classes';

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const MIN_SECRET_LENGTH = 16;
const DERIVED_KEY_BYTES = 32;

type ReactWithTaint = {
  experimental_taintObjectReference?: (message: string, object: object) => void;
  experimental_taintUniqueValue?: (message: string, lifetime: object, value: string) => void;
};

const taintLifetimeAnchor = Object.freeze({ scope: 'integration_crypto' });

function taintSecretBuffer(buffer: Buffer, message: string): void {
  const reactTaint = React as unknown as ReactWithTaint;
  if (typeof reactTaint.experimental_taintObjectReference === 'function') {
    try {
      reactTaint.experimental_taintObjectReference(message, buffer);
    } catch {
      // Ignore if already tainted or outside RSC context
    }
  }
}

function taintSecretString(secret: string, message: string): void {
  const reactTaint = React as unknown as ReactWithTaint;
  if (typeof reactTaint.experimental_taintUniqueValue === 'function') {
    try {
      reactTaint.experimental_taintUniqueValue(message, taintLifetimeAnchor, secret);
    } catch {
      // Ignore if value is too short or outside RSC context
    }
  }
}

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new APIError(
      'INTEGRATION_ENCRYPTION_KEY is missing or too short (>= 16 chars required)',
      { statusCode: 500, context: { component: 'integration_crypto' } }
    );
  }
  taintSecretString(secret, 'Do not pass INTEGRATION_ENCRYPTION_KEY to a Client Component.');
  cachedKey = scryptSync(secret, 'arch-integrations-v1', DERIVED_KEY_BYTES);
  taintSecretBuffer(
    cachedKey,
    'Do not pass derived integration encryption key buffer to a Client Component.'
  );
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
  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]).toString('utf8');
  taintSecretString(decrypted, 'Do not pass decrypted integration secret to a Client Component.');
  return decrypted;
}
