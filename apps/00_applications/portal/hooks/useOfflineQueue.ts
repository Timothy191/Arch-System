import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timestamp: number;
  description: string;
}

interface OfflineQueueState {
  queue: QueuedRequest[];
  isOnline: boolean;
  isSyncing: boolean;
  enqueue: (_request: Omit<QueuedRequest, "id" | "timestamp">) => void;
  dequeue: (_id: string) => void;
  clearQueue: () => void;
  setOnlineStatus: (_status: boolean) => void;
  sync: () => Promise<void>;
}

export const useOfflineQueue = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      isSyncing: false,

      enqueue: (request) => {
        const newReq: QueuedRequest = {
          ...request,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        };
        set((state) => ({ queue: [...state.queue, newReq] }));
        if (typeof window !== "undefined") {
          toast.info(`Saved offline: ${request.description}`);
        }
      },

      dequeue: (id) => {
        set((state) => ({
          queue: state.queue.filter((req) => req.id !== id),
        }));
      },

      clearQueue: () => set({ queue: [] }),

      setOnlineStatus: (status) => {
        set({ isOnline: status });
      },

      sync: async () => {
        const state = get();
        if (!state.isOnline || state.isSyncing || state.queue.length === 0) return;

        set({ isSyncing: true });
        let successCount = 0;
        let failCount = 0;

        for (const req of state.queue) {
          try {
            const res = await fetch(req.url, {
              method: req.method,
              headers: req.headers,
              body: req.body,
            });

            if (res.ok) {
              state.dequeue(req.id);
              successCount++;
            } else {
              failCount++;
            }
          } catch (e) {
            failCount++;
          }
        }

        set({ isSyncing: false });

        if (successCount > 0) {
          toast.success(`Synced ${successCount} offline items to the server.`);
        }
        if (failCount > 0) {
          toast.error(`Failed to sync ${failCount} items. Will retry later.`);
        }
      },
    }),
    {
      name: "arch-offline-queue",
    },
  ),
);

// We need a way to initialize the listeners
export function initOfflineQueueListeners() {
  if (typeof window === "undefined") return;

  const handleOnline = () => {
    useOfflineQueue.getState().setOnlineStatus(true);
    useOfflineQueue.getState().sync();
  };

  const handleOffline = () => {
    useOfflineQueue.getState().setOnlineStatus(false);
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  // Initial sync attempt if we load the page online and have queued items
  if (navigator.onLine) {
    useOfflineQueue.getState().sync();
  }

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}
