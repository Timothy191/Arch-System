import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import type { RemoteSupportProtocol } from '@repo/contract';

export const TIER2_TOKEN_TTL_SECONDS = 60;
export const MIN_TIER2_SECRET_LENGTH = 32;
const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const TOKEN_VERSION = 1;

export interface Tier2ConnectionSettings {
  readonly hostname: string;
  readonly port: number;
  readonly username?: string;
  readonly password?: string;
  readonly domain?: string;
  readonly security?: 'nla' | 'tls' | 'rdp' | 'any';
  readonly ignoreCert?: boolean;
  readonly colorDepth?: 16 | 24 | 32;
  readonly resizeMethod?: 'display-update' | 'reconnect';
  readonly readOnly?: boolean;
}

export interface Tier2LaunchPayload {
  readonly v: 1;
  readonly jti: string;
  readonly exp: number;
  readonly sessionId: string;
  readonly actorId: string;
  readonly deviceId: string;
  readonly connection: {
    readonly type: RemoteSupportProtocol;
    readonly settings: Tier2ConnectionSettings;
  };
}

export interface EncryptTier2LaunchTokenOptions {
  readonly secret: string;
  readonly sessionId: string;
  readonly actorId: string;
  readonly deviceId: string;
  readonly protocol: RemoteSupportProtocol;
  readonly settings: Tier2ConnectionSettings;
  readonly ttlSeconds?: number;
  readonly nowMs?: number;
}

export interface DecryptTier2LaunchTokenOptions {
  readonly token: string;
  readonly secret: string;
  readonly nowMs?: number;
}

function deriveEncryptionKey(secret: string): Buffer {
  if (!secret || secret.length < MIN_TIER2_SECRET_LENGTH) {
    throw new Error(
      `REMOTE_DESKTOP_TOKEN_SECRET must be at least ${MIN_TIER2_SECRET_LENGTH} characters`
    );
  }
  return createHash('sha256').update(secret, 'utf8').digest();
}

/**
 * Encrypts a short-lived single-use Tier 2 launch token using AES-256-GCM.
 * Token format: base64url(iv).base64url(authTag).base64url(ciphertext)
 */
export function encryptTier2LaunchToken(options: EncryptTier2LaunchTokenOptions): {
  readonly token: string;
  readonly jti: string;
  readonly expiresAt: string;
} {
  const key = deriveEncryptionKey(options.secret);
  const nowMs = options.nowMs ?? Date.now();
  const ttlSeconds = options.ttlSeconds ?? TIER2_TOKEN_TTL_SECONDS;
  const exp = Math.floor(nowMs / 1000) + ttlSeconds;
  const jti = randomUUID();

  const payload: Tier2LaunchPayload = {
    v: TOKEN_VERSION,
    jti,
    exp,
    sessionId: options.sessionId,
    actorId: options.actorId,
    deviceId: options.deviceId,
    connection: {
      type: options.protocol,
      settings: options.settings,
    },
  };

  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(AES_ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const token = [
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');

  return {
    token,
    jti,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

/**
 * Decrypts and validates a Tier 2 launch token, rejecting tampered or expired payloads.
 */
export function decryptTier2LaunchToken(
  options: DecryptTier2LaunchTokenOptions
): Tier2LaunchPayload {
  const key = deriveEncryptionKey(options.secret);
  const parts = options.token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed Tier 2 launch token');
  }

  const [ivPart, tagPart, dataPart] = parts;
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error('Incomplete Tier 2 launch token');
  }

  const iv = Buffer.from(ivPart, 'base64url');
  const authTag = Buffer.from(tagPart, 'base64url');
  const encrypted = Buffer.from(dataPart, 'base64url');

  const decipher = createDecipheriv(AES_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  const parsed = JSON.parse(decrypted.toString('utf8')) as Tier2LaunchPayload;

  if (parsed.v !== TOKEN_VERSION || !parsed.jti || !parsed.sessionId || !parsed.deviceId) {
    throw new Error('Invalid Tier 2 launch token payload');
  }

  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000);
  if (typeof parsed.exp !== 'number' || parsed.exp <= nowSeconds) {
    throw new Error('Tier 2 launch token expired');
  }

  return parsed;
}
