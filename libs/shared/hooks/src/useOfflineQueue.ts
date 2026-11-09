import { compareHlc as compareCanonicalHlc, type Hlc } from '@repo/utils/hlc';
import { del, get, set } from 'idb-keyval';
import { toast } from 'sonner';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

const MAX_QUEUE_RETRIES = 3;
const HTTP_CLIENT_ERROR_MIN = 400;
const HTTP_SERVER_ERROR_MIN = 500;
const HTTP_REQUEST_TIMEOUT = 408;
const HTTP_TOO_MANY_REQUESTS = 429;

function isNonRetryableClientError(status: number | undefined): boolean {
  if (typeof status !== 'number') return false;
  return (
    status >= HTTP_CLIENT_ERROR_MIN &&
    status < HTTP_SERVER_ERROR_MIN &&
    status !== HTTP_REQUEST_TIMEOUT &&
    status !== HTTP_TOO_MANY_REQUESTS
  );
}

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timestamp: number;
  description: string;
  hlc?: Hlc;
  retryCount?: number;
  lastError?: string;
}

interface OfflineQueueState {
  queue: QueuedRequest[];
  deadLetterQueue: QueuedRequest[];
  isOnline: boolean;
  isSyncing: boolean;
  enqueue: (_request: Omit<QueuedRequest, 'id' | 'timestamp' | 'hlc'>) => void;
  dequeue: (_id: string) => void;
  clearQueue: () => void;
  clearDeadLetterQueue: () => void;
  setOnlineStatus: (_status: boolean) => void;
  sync: () => Promise<void>;
}

const memoryFallback = new Map<string, string>();

const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (typeof indexedDB === 'undefined') {
      return memoryFallback.get(name) || null;
    }
    try {
      return (await get(name)) || null;
    } catch {
      return memoryFallback.get(name) || null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (typeof indexedDB === 'undefined') {
      memoryFallback.set(name, value);
      return;
    }
    try {
      await set(name, value);
    } catch {
      memoryFallback.set(name, value);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    if (typeof indexedDB === 'undefined') {
      memoryFallback.delete(name);
      return;
    }
    try {
      await del(name);
    } catch {
      memoryFallback.delete(name);
    }
  },
};

/** Legacy queued items may lack an HLC; treat those as concurrent (stable order). */
const compareHlc = (a?: Hlc, b?: Hlc) => {
  if (!a || !b) return 0;
  return compareCanonicalHlc(a, b);
};

export const useOfflineQueue = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      deadLetterQueue: [],
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSyncing: false,

      enqueue: (request) => {
        const newReq: QueuedRequest = {
          ...request,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          hlc: { wall: Date.now(), counter: 0, node: 'client' },
          retryCount: 0,
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

      clearDeadLetterQueue: () => set({ deadLetterQueue: [] }),

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
              // The queue id is the replay identity: the server answers a repeat
              // with the stored result instead of writing the row twice.
              headers: { ...req.headers, 'x-idempotency-key': req.id },
              body: req.body,
            });

            if (res.ok) {
              state.dequeue(req.id);
              successCount++;
              continue;
            }

            failCount++;
            const nextRetryCount = (req.retryCount ?? 0) + 1;
            const errorReason =
              typeof res.status === 'number' ? `HTTP ${res.status}` : 'Sync response not ok';

            if (isNonRetryableClientError(res.status) || nextRetryCount >= MAX_QUEUE_RETRIES) {
              set((current) => ({
                queue: current.queue.filter((queued) => queued.id !== req.id),
                deadLetterQueue: [
                  ...current.deadLetterQueue,
                  { ...req, retryCount: nextRetryCount, lastError: errorReason },
                ],
              }));
            } else {
              set((current) => ({
                queue: current.queue.map((queued) =>
                  queued.id === req.id
                    ? { ...queued, retryCount: nextRetryCount, lastError: errorReason }
                    : queued
                ),
              }));
            }
          } catch (err) {
            failCount++;
            const nextRetryCount = (req.retryCount ?? 0) + 1;
            const errorReason = err instanceof Error ? err.message : 'Network error';

            if (nextRetryCount >= MAX_QUEUE_RETRIES) {
              set((current) => ({
                queue: current.queue.filter((queued) => queued.id !== req.id),
                deadLetterQueue: [
                  ...current.deadLetterQueue,
                  { ...req, retryCount: nextRetryCount, lastError: errorReason },
                ],
              }));
            } else {
              set((current) => ({
                queue: current.queue.map((queued) =>
                  queued.id === req.id
                    ? { ...queued, retryCount: nextRetryCount, lastError: errorReason }
                    : queued
                ),
              }));
            }
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
      name: 'arch-offline-queue',
      storage: createJSONStorage(() => idbStorage),
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
