"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchClient, offlineStorage, type QueuedFetchRequest } from "@repo/utils/client";

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
  }, [refreshQueue]);

  const flushQueue = async () => {
    setIsSyncing(true);
    try {
      const res = await fetchClient.flushOfflineQueue();
      await refreshQueue();
      return res;
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    pendingQueue,
    pendingCount: pendingQueue.length,
    isOnline,
    isSyncing,
    flushQueue,
    refreshQueue,
  };
}
