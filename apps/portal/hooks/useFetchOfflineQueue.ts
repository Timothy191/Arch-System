"use client";

import { fetchClient, offlineStorage, type QueuedFetchRequest } from "@repo/utils/client";
import { useCallback, useEffect, useState } from "react";

export function useFetchOfflineQueue() {
  const [pendingQueue, setPendingQueue] = useState<QueuedFetchRequest[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshQueue = useCallback(async () => {
    try {
      const pending = await offlineStorage.getPending();
      setPendingQueue(pending);
    } catch {
      setPendingQueue([]);
    }
  }, []);

  const flushQueue = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetchClient.flushOfflineQueue();
      await refreshQueue();
      return res;
    } finally {
      setIsSyncing(false);
    }
  }, [refreshQueue]);

  useEffect(() => {
    refreshQueue();

    const handleOnline = () => {
      setIsOnline(true);
      flushQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
    };
  }, [refreshQueue, flushQueue]);

  return {
    pendingQueue,
    pendingCount: pendingQueue.length,
    isOnline,
    isSyncing,
    flushQueue,
    refreshQueue,
  };
}
