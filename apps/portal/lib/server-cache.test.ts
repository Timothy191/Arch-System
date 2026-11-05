import { cacheInvalidateTags } from '@repo/redis';
import * as nextCache from 'next/cache';
import {
  cacheLife,
  cacheProfiles,
  cacheTag,
  refreshAction,
  refreshTag,
  revalidateTagInRouteHandler,
  scopedTag,
  tagDepartment,
  tagTenant,
  updateTag,
  updateTags,
} from './server-cache';

jest.mock('@repo/redis', () => ({
  cacheInvalidateTags: jest.fn().mockResolvedValue(undefined),
}));

describe('server-cache (Next.js 16 Frontend-as-Backend Cache API)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('constructs deterministic scoped, tenant, and department cache tags', () => {
    expect(scopedTag('machine', 'exc-01')).toBe('machine:exc-01');
    expect(tagTenant('tenant-1', 'loads')).toBe('tenant:tenant-1:loads');
    expect(tagDepartment('control-room', 'shift_closeout')).toBe(
      'dept:control-room:shift_closeout'
    );
  });

  it('updateTag invalidates Next.js Data Cache (read-your-writes) and purges Redis L1/L2 tags', async () => {
    await updateTag('dept:control-room:loads');
    expect(cacheInvalidateTags).toHaveBeenCalledWith(['dept:control-room:loads']);
  });

  it('updateTags bulk-invalidates multiple tags across Next.js and Redis', async () => {
    const targetTags = ['dept:control-room:loads', 'dept:control-room:delays'];
    await updateTags(targetTags);
    expect(cacheInvalidateTags).toHaveBeenCalledWith(targetTags);
  });

  it('refreshTag and revalidateTagInRouteHandler pass profile to revalidateTag and purge Redis', async () => {
    const revalidateSpy = jest.spyOn(nextCache, 'revalidateTag');
    refreshTag('dept:drilling:kpi', 'hours');
    expect(revalidateSpy).toHaveBeenCalledWith('dept:drilling:kpi', cacheProfiles.hours);

    await revalidateTagInRouteHandler('dept:drilling:kpi', 'minutes');
    expect(revalidateSpy).toHaveBeenCalledWith('dept:drilling:kpi', cacheProfiles.minutes);
    expect(cacheInvalidateTags).toHaveBeenCalledWith(['dept:drilling:kpi']);
  });

  it('refreshAction safely invokes next/cache refresh when available', () => {
    expect(() => refreshAction()).not.toThrow();
  });

  it('cacheTag and cacheLife apply Next.js 16 Cache Component profiles without throwing', () => {
    expect(() => cacheTag('dept:control-room:summary')).not.toThrow();
    expect(() => cacheLife('telemetry')).not.toThrow();
    expect(() => cacheLife('hours')).not.toThrow();
    expect(() => cacheLife({ stale: 10, revalidate: 30, expire: 120 })).not.toThrow();
    expect(cacheProfiles.telemetry.revalidate).toBe(10);
  });
});
