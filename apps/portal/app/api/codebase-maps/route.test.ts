/**
 * @jest-environment node
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { GET } from './route';

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(),
}));

const mockGetAuthenticatedEmployee = jest.mocked(getAuthenticatedEmployee);

// FIXTURE_ROOT is intentionally unused; tests use a temporary directory instead.

function makeRequest(search = '') {
  return new Request(`http://localhost:3000/api/codebase-maps${search ? `?${search}` : ''}`);
}

describe('GET /api/codebase-maps', () => {
  const tempRoot = path.join(os.tmpdir(), `codebase-maps-tests-${Date.now()}`);

  beforeAll(() => {
    fs.mkdirSync(tempRoot, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  beforeEach(() => {
    mockGetAuthenticatedEmployee.mockResolvedValue({
      user: { id: 'user-1' },
      employee: { id: 'employee-1', role: 'operator' },
    } as Awaited<ReturnType<typeof getAuthenticatedEmployee>>);
  });

  it('returns defaults when no query params are provided', async () => {
    fs.mkdirSync(path.join(tempRoot, 'latest'), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, 'manifest.json'), '[]');
    fs.writeFileSync(
      path.join(tempRoot, 'latest', 'route-feature-architecture.md'),
      '# default map'
    );

    const res = await GET(makeRequest(), { mapsRoot: tempRoot });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      manifest: [],
      activeLogId: 'latest',
      activeFileKey: 'route-feature-architecture.md',
      content: '# default map',
    });
  });

  it('uses explicit log and file query params', async () => {
    fs.mkdirSync(path.join(tempRoot, 'abc'), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, 'manifest.json'), '[{"logId":"abc"}]');
    fs.writeFileSync(path.join(tempRoot, 'abc', 'custom.md'), '# custom map');

    const res = await GET(makeRequest('log=abc&file=custom.md'), { mapsRoot: tempRoot });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      manifest: [{ logId: 'abc' }],
      activeLogId: 'abc',
      activeFileKey: 'custom.md',
      content: '# custom map',
    });
  });

  it('falls back to the maps root when the requested log directory does not exist', async () => {
    fs.writeFileSync(path.join(tempRoot, 'manifest.json'), '[]');
    fs.writeFileSync(path.join(tempRoot, 'route-feature-architecture.md'), '# fallback map');

    const res = await GET(makeRequest('log=missing'), { mapsRoot: tempRoot });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.activeLogId).toBe('missing');
    expect(json.content).toBe('# fallback map');
  });

  it('returns an unavailable message when the map file is missing', async () => {
    fs.mkdirSync(path.join(tempRoot, 'latest'), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, 'manifest.json'), '[]');

    const res = await GET(makeRequest('file=missing.md'), { mapsRoot: tempRoot });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.content).toBe('# missing.md\n\nMap content unavailable.');
  });

  it('handles invalid manifest JSON without crashing', async () => {
    fs.mkdirSync(path.join(tempRoot, 'latest'), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, 'manifest.json'), 'not-json');
    fs.writeFileSync(path.join(tempRoot, 'latest', 'route-feature-architecture.md'), '# map');

    const res = await GET(makeRequest(), { mapsRoot: tempRoot });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.manifest).toEqual([]);
    expect(json.content).toBe('# map');
  });

  it('rejects unauthenticated requests', async () => {
    mockGetAuthenticatedEmployee.mockResolvedValueOnce(null);

    const res = await GET(makeRequest(), { mapsRoot: tempRoot });

    expect(res.status).toBe(401);
  });

  it.each([
    'file=../../../../.env',
    'file=..%2F..%2F..%2F.env',
    'file=/etc/passwd',
    'file=..%2Froute-feature-architecture.md',
    'log=../../etc',
    'log=..%2F..',
  ])('rejects traversal payload %s', async (query) => {
    const res = await GET(makeRequest(query), { mapsRoot: tempRoot });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toEqual({
      success: false,
      error: expect.any(String),
      code: 'INVALID_REQUEST',
    });
  });

  it('only serves markdown map files', async () => {
    const res = await GET(makeRequest('file=manifest.json'), { mapsRoot: tempRoot });

    expect(res.status).toBe(400);
  });
});
