import { createHmac, timingSafeEqual } from 'node:crypto';

const MIN_VERCEL_SECRET_LENGTH = 8;
const SHA1_PREFIX = 'sha1=';

export interface VerifyVercelSignatureOptions {
  readonly rawBody: string;
  readonly signatureHeader: string | null;
  readonly secret: string | undefined;
}

export function computeVercelSignature(rawBody: string, secret: string): string {
  return createHmac('sha1', secret).update(rawBody, 'utf8').digest('hex');
}

export function verifyVercelSignature(options: VerifyVercelSignatureOptions): boolean {
  const { rawBody, signatureHeader, secret } = options;

  if (!secret || secret.trim().length < MIN_VERCEL_SECRET_LENGTH) {
    return false;
  }

  if (!signatureHeader || signatureHeader.trim().length === 0) {
    return false;
  }

  const normalizedCandidate = signatureHeader.trim().toLowerCase().startsWith(SHA1_PREFIX)
    ? signatureHeader.trim().slice(SHA1_PREFIX.length).toLowerCase()
    : signatureHeader.trim().toLowerCase();

  const expectedDigest = computeVercelSignature(rawBody, secret).toLowerCase();

  const candidateBuffer = Buffer.from(normalizedCandidate, 'utf8');
  const expectedBuffer = Buffer.from(expectedDigest, 'utf8');

  if (candidateBuffer.byteLength !== expectedBuffer.byteLength) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, expectedBuffer);
}
