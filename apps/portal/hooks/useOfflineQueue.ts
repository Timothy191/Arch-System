import { toast } from 'sonner';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Hlc = { wall: number; counter: number; node: string };

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timestamp: number;
  description: string;
  hlc: Hlc;
}

interface OfflineQueueState {
  queue: QueuedRequest[];
  isOnline: boolean;
  isSyncing: boolean;
  enqueue: (_request: Omit<QueuedRequest, 'id' | 'timestamp' | 'hlc'>) => void;
  dequeue: (_id: string) => void;
  clearQueue: () => void;
  setOnlineStatus: (_status: boolean) => void;
  sync: () => Promise<void>;
}

const compareHlc = (a: Hlc, b: Hlc) =>
  a.wall - b.wall || a.counter - b.counter || a.node.localeCompare(b.node);

export const useOfflineQueue = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSyncing: false,

      enqueue: (request) => {
        const newReq: QueuedRequest = {
          ...request,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          hlc: { wall: Date.now(), counter: 0, node: 'client' }, // basic hlc
        };
        set((state) => ({ queue: [...state.queue, newReq] }));
        if (typeof window !== 'undefined') {
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
        if (get().isOnline === status) return;
        set({ isOnline: status });
      },

      sync: async () => {
        const state = get();
        if (!state.isOnline || state.isSyncing || state.queue.length === 0) return;

        set({ isSyncing: true });
        let successCount = 0;
        let failCount = 0;

        const sortedQueue = [...state.queue].sort((a, b) => compareHlc(a.hlc, b.hlc));

        for (const req of sortedQueue) {
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
          } catch (_e) {
            failCount++;
          }
        }

        set({ isSyncing: false });

        if (successCount > 0) {
          toast.success(`Synced ${successCount} offline items to the server.`);
        }
      },
    }),
    {
      name: 'arch-offline-queue',
    }
  )
);

export function initOfflineQueueListeners() {
  if (typeof window === 'undefined') return;

  const handleOnline = () => {
    useOfflineQueue.getState().setOnlineStatus(true);
    useOfflineQueue.getState().sync();
  };

  const handleOffline = () => {
    useOfflineQueue.getState().setOnlineStatus(false);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  if (navigator.onLine) {
    useOfflineQueue.getState().sync();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
