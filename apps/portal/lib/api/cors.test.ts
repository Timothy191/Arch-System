/**
 * @jest-environment node
 */
import { NextResponse } from 'next/server';
import { applyCors } from './cors';

describe('applyCors origin allowlist enforcement', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      NEXT_PUBLIC_SITE_URL: 'https://arch.plantcor.co.za',
      VERCEL_URL: 'arch-system-preview.vercel.app',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('allows configured NEXT_PUBLIC_SITE_URL origin and sets Vary: Origin', () => {
    const req = new Request('https://arch.plantcor.co.za/api/export/machines', {
      headers: { origin: 'https://arch.plantcor.co.za' },
    });
    const res = applyCors(req, NextResponse.json({ ok: true }));

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://arch.plantcor.co.za');
    expect(res.headers.get('Vary')).toContain('Origin');
  });

  it('normalizes bare VERCEL_URL hostname with https://', () => {
    const req = new Request('https://arch-system-preview.vercel.app/api/export/machines', {
      headers: { origin: 'https://arch-system-preview.vercel.app' },
    });
    const res = applyCors(req, NextResponse.json({ ok: true }));

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://arch-system-preview.vercel.app'
    );
  });

  it('rejects arbitrary untrusted Origin headers instead of echoing them or setting wildcard', () => {
    const req = new Request('https://arch.plantcor.co.za/api/export/machines', {
      headers: { origin: 'https://evil-attacker.example.com' },
    });
    const initial = NextResponse.json({ ok: true });
    initial.headers.set('Access-Control-Allow-Origin', '*');

    const res = applyCors(req, initial);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(res.headers.get('Vary')).toContain('Origin');
  });

  it('blocks localhost in production but allows localhost in development', () => {
    const localhostReq = new Request('http://localhost:3000/api/scada/tags', {
      headers: { origin: 'http://localhost:3000' },
    });

    const prodRes = applyCors(localhostReq, NextResponse.json({ ok: true }));
    expect(prodRes.headers.get('Access-Control-Allow-Origin')).toBeNull();

    process.env = { ...process.env, NODE_ENV: 'development' };
    const devRes = applyCors(localhostReq, NextResponse.json({ ok: true }));
    expect(devRes.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
  });
});
