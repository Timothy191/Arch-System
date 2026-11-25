import { decryptTier2LaunchToken, encryptTier2LaunchToken } from './tier2-token';

const VALID_SECRET = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6';

describe('tier2-token AES-256-GCM encryption', () => {
  it('encrypts and decrypts a Tier 2 launch payload cleanly', () => {
    const nowMs = 1_700_000_000_000;
    const minted = encryptTier2LaunchToken({
      secret: VALID_SECRET,
      sessionId: '00000000-0000-0000-0000-000000000001',
      actorId: '00000000-0000-0000-0000-000000000002',
      deviceId: '00000000-0000-0000-0000-000000000003',
      protocol: 'rdp',
      settings: {
        hostname: '10.20.4.18',
        port: 3389,
        security: 'nla',
      },
      nowMs,
    });

    expect(minted.token.split('.')).toHaveLength(3);
    const decoded = decryptTier2LaunchToken({
      token: minted.token,
      secret: VALID_SECRET,
      nowMs: nowMs + 10_000,
    });
    expect(decoded.jti).toBe(minted.jti);
    expect(decoded.connection.type).toBe('rdp');
    expect(decoded.connection.settings.hostname).toBe('10.20.4.18');
  });

  it('rejects secrets shorter than 32 characters', () => {
    expect(() =>
      encryptTier2LaunchToken({
        secret: 'too-short',
        sessionId: 's1',
        actorId: 'a1',
        deviceId: 'd1',
        protocol: 'vnc',
        settings: { hostname: '10.0.0.5', port: 5900 },
      })
    ).toThrow(/at least 32/i);
  });

  it('rejects expired or tampered tokens', () => {
    const nowMs = 1_700_000_000_000;
    const minted = encryptTier2LaunchToken({
      secret: VALID_SECRET,
      sessionId: 's1',
      actorId: 'a1',
      deviceId: 'd1',
      protocol: 'ssh',
      settings: { hostname: '10.0.0.5', port: 22 },
      ttlSeconds: 30,
      nowMs,
    });

    expect(() =>
      decryptTier2LaunchToken({
        token: minted.token,
        secret: VALID_SECRET,
        nowMs: nowMs + 31_000,
      })
    ).toThrow(/expired/i);

    const parts = minted.token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.${parts[2]?.slice(0, -2)}AA`;
    expect(() =>
      decryptTier2LaunchToken({
        token: tampered,
        secret: VALID_SECRET,
        nowMs: nowMs + 1_000,
      })
    ).toThrow();
  });
});
