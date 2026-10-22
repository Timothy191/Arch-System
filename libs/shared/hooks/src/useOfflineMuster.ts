'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { usePitConnectivity } from './usePitConnectivity';

// Fallback interface matching MusterSummary
export interface MusterSummary {
  totalSoulsOnSite: number;
  blastStatus: 'CLEAR' | 'WARNING' | 'IMMINENT' | 'ALL_CLEAR';
  lastUpdated: string;
}

export type CachedMusterData<TData = MusterSummary> = TData & {
  _cachedAt?: string;
};

const MUSTER_CACHE_KEY = 'arch_muster_cache_v1';

export function useOfflineMuster<
  TData extends Record<string, unknown> | MusterSummary = MusterSummary,
>(deptId: string, fetchAction: (id: string) => Promise<TData>) {
  const { isOnline } = usePitConnectivity();
  const [offlineData, setOfflineData] = useState<CachedMusterData<TData> | null>(null);

  // 1. Fetch live data via TanStack Query (Polling every 60s when online)
  const { data: liveData, error } = useQuery({
    queryKey: ['muster-roll-call', deptId],
    queryFn: () => fetchAction(deptId),
    refetchInterval: isOnline ? 60000 : false,
    enabled: isOnline,
  });

  // 2. Persist to LocalStorage whenever live data updates
  useEffect(() => {
    if (liveData) {
      try {
        localStorage.setItem(
          MUSTER_CACHE_KEY,
          JSON.stringify({
            ...liveData,
            _cachedAt: new Date().toISOString(),
          })
        );
      } catch (err) {
        console.error('Failed to cache muster data', err);
      }
    }
  }, [liveData]);

  // 3. Load from LocalStorage when offline
  useEffect(() => {
    if (!isOnline) {
      try {
        const cached = localStorage.getItem(MUSTER_CACHE_KEY);
        if (cached) {
          setOfflineData(JSON.parse(cached) as CachedMusterData<TData>);
        }
      } catch (err) {
        console.error('Failed to parse offline muster data', err);
      }
    } else {
      setOfflineData(null);
    }
  }, [isOnline]);

  return {
    data: isOnline ? liveData : offlineData,
    isOffline: !isOnline,
    staleSince: !isOnline && offlineData ? (offlineData._cachedAt ?? null) : null,
    error,
  };
}
