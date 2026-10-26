/**
 * @jest-environment node
 */

import { decryptSecret, encryptSecret } from './crypto';

describe('integration crypto (AES-256-GCM)', () => {
  const ORIGINAL_ENV = process.env.INTEGRATION_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';
  });

  afterAll(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = ORIGINAL_ENV;
  });

  it('encrypts and decrypts round-trip with distinct IVs per call', () => {
    const plaintext = 'super-secret-bearer-token-xyz';
    const c1 = encryptSecret(plaintext);
    const c2 = encryptSecret(plaintext);
    expect(c1).not.toBe(c2);
    expect(decryptSecret(c1)).toBe(plaintext);
    expect(decryptSecret(c2)).toBe(plaintext);
  });

  it('rejects tampered ciphertext', () => {
    const ciphertext = encryptSecret('secret-value');
    const raw = Buffer.from(ciphertext, 'base64');
    raw[raw.length - 1] ^= 0xff;
    const tampered = raw.toString('base64');
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('rejects malformed short ciphertext', () => {
    expect(() => decryptSecret(Buffer.from('short').toString('base64'))).toThrow();
  });
});
