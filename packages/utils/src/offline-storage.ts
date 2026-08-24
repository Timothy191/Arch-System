export interface QueuedFetchRequest {
  id?: number;
  idempotencyKey: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  description?: string;
  status: "pending" | "processing" | "synced" | "failed";
  retryCount: number;
  createdAt: number;
  lastAttemptAt?: number;
  errorMessage?: string;
}

export interface CachedFetchResponse<T = unknown> {
  cacheKey: string;
  data: T;
  headers?: Record<string, string>;
  cachedAt: number;
  expiresAt?: number;
}

export class IDBOfflineStorage {
  private dbName = "ArchOfflineFetchDB";
  private dbVersion = 1;
  private queueStore = "requestQueue";
  private cacheStore = "readCache";
  private db: IDBDatabase | null = null;
  private inMemoryQueue: QueuedFetchRequest[] = [];
  private inMemoryCache: Map<string, CachedFetchResponse> = new Map();

  private isSupported(): boolean {
    return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
  }

  private async getDB(): Promise<IDBDatabase | null> {
    if (!this.isSupported()) return null;
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      try {
        const request = window.indexedDB.open(this.dbName, this.dbVersion);

        request.onerror = () => {
          resolve(null);
        };

        request.onsuccess = () => {
          this.db = request.result;
          resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(this.queueStore)) {
            const store = db.createObjectStore(this.queueStore, {
              keyPath: "id",
              autoIncrement: true,
            });
            store.createIndex("status", "status", { unique: false });
            store.createIndex("idempotencyKey", "idempotencyKey", { unique: true });
          }
          if (!db.objectStoreNames.contains(this.cacheStore)) {
            db.createObjectStore(this.cacheStore, { keyPath: "cacheKey" });
          }
        };
      } catch {
        resolve(null);
      }
    });
  }

  public async enqueue(
    request: Omit<QueuedFetchRequest, "id" | "status" | "retryCount" | "createdAt">,
  ): Promise<QueuedFetchRequest> {
    const fullItem: QueuedFetchRequest = {
      ...request,
      status: "pending",
      retryCount: 0,
      createdAt: Date.now(),
    };

    const db = await this.getDB();
    if (!db) {
      this.inMemoryQueue.push(fullItem);
      return fullItem;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.queueStore, "readwrite");
      const store = tx.objectStore(this.queueStore);
      const req = store.add(fullItem);

      req.onsuccess = () => {
        fullItem.id = req.result as number;
        resolve(fullItem);
      };

      req.onerror = () => {
        this.inMemoryQueue.push(fullItem);
        resolve(fullItem);
      };
    });
  }

  public async getPending(): Promise<QueuedFetchRequest[]> {
    const db = await this.getDB();
    if (!db) {
      return this.inMemoryQueue.filter((item) => item.status === "pending");
    }

    return new Promise((resolve) => {
      const tx = db.transaction(this.queueStore, "readonly");
      const store = tx.objectStore(this.queueStore);
      const index = store.index("status");
      const req = index.getAll("pending");

      req.onsuccess = () => {
        resolve(req.result as QueuedFetchRequest[]);
      };

      req.onerror = () => {
        resolve(this.inMemoryQueue.filter((item) => item.status === "pending"));
      };
    });
  }

  public async remove(id: number): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      this.inMemoryQueue = this.inMemoryQueue.filter((item) => item.id !== id);
      return;
    }

    return new Promise((resolve) => {
      const tx = db.transaction(this.queueStore, "readwrite");
      const store = tx.objectStore(this.queueStore);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  }

  public async updateStatus(
    id: number,
    status: QueuedFetchRequest["status"],
    errorMessage?: string,
  ): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      const found = this.inMemoryQueue.find((item) => item.id === id);
      if (found) {
        found.status = status;
        if (errorMessage) found.errorMessage = errorMessage;
        found.lastAttemptAt = Date.now();
        found.retryCount++;
      }
      return;
    }

    return new Promise((resolve) => {
      const tx = db.transaction(this.queueStore, "readwrite");
      const store = tx.objectStore(this.queueStore);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const item = getReq.result as QueuedFetchRequest | undefined;
        if (item) {
          item.status = status;
          if (errorMessage) item.errorMessage = errorMessage;
          item.lastAttemptAt = Date.now();
          item.retryCount++;
          store.put(item);
        }
        resolve();
      };

      getReq.onerror = () => resolve();
    });
  }

  public async cacheResponse<T>(
    cacheKey: string,
    data: T,
    ttlMs: number = 86400000,
  ): Promise<void> {
    const item: CachedFetchResponse<T> = {
      cacheKey,
      data,
      cachedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    };

    const db = await this.getDB();
    if (!db) {
      this.inMemoryCache.set(cacheKey, item);
      return;
    }

    return new Promise((resolve) => {
      const tx = db.transaction(this.cacheStore, "readwrite");
      const store = tx.objectStore(this.cacheStore);
      store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  public async getCachedResponse<T>(cacheKey: string): Promise<T | null> {
    const db = await this.getDB();
    if (!db) {
      const cached = this.inMemoryCache.get(cacheKey);
      if (!cached) return null;
      if (cached.expiresAt && cached.expiresAt < Date.now()) {
        this.inMemoryCache.delete(cacheKey);
        return null;
      }
      return cached.data as T;
    }

    return new Promise((resolve) => {
      const tx = db.transaction(this.cacheStore, "readonly");
      const store = tx.objectStore(this.cacheStore);
      const req = store.get(cacheKey);

      req.onsuccess = () => {
        const cached = req.result as CachedFetchResponse<T> | undefined;
        if (!cached) return resolve(null);
        if (cached.expiresAt && cached.expiresAt < Date.now()) {
          resolve(null);
        } else {
          resolve(cached.data);
        }
      };

      req.onerror = () => resolve(null);
    });
  }
}

export const offlineStorage = new IDBOfflineStorage();
