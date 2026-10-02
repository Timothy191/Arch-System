/**
 * @jest-environment node
 */
import { GET } from './route';

describe('/api/version GET', () => {
  it('returns valid system version and telemetry metadata', async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('nominal');
    expect(data.name).toBe('Arch-System Portal');
    expect(typeof data.version).toBe('string');
    expect(data.version.length).toBeGreaterThan(0);
    expect(typeof data.commit).toBe('string');
    expect(typeof data.buildTimestamp).toBe('string');
    expect(response.headers.get('X-App-Version')).toBe(data.version);
  });
});
