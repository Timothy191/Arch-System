/**
 * Stripe-tier Browser-Native Local-First Queue-and-Replay Synchronization Engine.
 * Powered by persistent IndexedDB with zero third-party dependencies.
 */

import { DatabaseError } from "@/lib/errors/error-classes";
import { logError } from "@/lib/errors/error-logger";

export interface QueuedAction<T = unknown> {
  id?: number;
  idempotencyKey: string;
  actionType: string;
  payload: T;
  departmentId: string;
  status: "pending" | "synced" | "failed";
  retryCount: number;
  createdAt: number;
}

class SyncQueue {
  private dbName = "ArchSyncDB";
  private dbVersion = 1;
  private storeName = "actionQueue";
  private db: IDBDatabase | null = null;
  private isProcessing = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.initDB().then(() => {
        this.processQueue();
        window.addEventListener("online", () => {
          this.processQueue();
        });
      });
    }
  }

  /**
   * Initialize IndexedDB database and object store
   */
  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        logError(new Error("Failed to open IndexedDB for SyncQueue"), {
          context: "sync_queue_indexeddb_open",
        });
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("idempotencyKey", "idempotencyKey", {
            unique: true,
          });
        }
      };
    });
  }

  /**
   * Enqueue a new mutation action
   */
  public async enqueueAction<T = unknown>(
    actionType: string,
    payload: T,
    departmentId: string,
  ): Promise<string> {
    const idempotencyKey = crypto.randomUUID();
    const action: QueuedAction = {
      idempotencyKey,
      actionType,
      payload,
      departmentId,
      status: "pending",
      retryCount: 0,
      createdAt: Date.now(),
    };

    await this.initDB();
    if (!this.db) {
      throw new DatabaseError("Database not initialized", {
        operation: "init",
        context: { reason: "indexeddb_init_failed" },
      });
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.add(action);

      request.onsuccess = () => {
        // Attempt immediate processing if online
        if (navigator.onLine) {
          this.processQueue();
        }
        resolve(idempotencyKey);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Fetch all pending actions from local store
   */
  private getPendingActions(): Promise<QueuedAction[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve([]);

      const transaction = this.db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const index = store.index("status");
      const request = index.getAll(IDBKeyRange.only("pending"));

      request.onsuccess = () => {
        resolve(request.result as QueuedAction[]);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Update status of an action
   */
  private updateAction(action: QueuedAction): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject("No DB");

      const transaction = this.db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.put(action);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Process all pending synchronization queues (Replay Engine)
   */
  public async processQueue(): Promise<void> {
    if (this.isProcessing || !navigator.onLine) return;
    this.isProcessing = true;

    try {
      await this.initDB();
      const pending = await this.getPendingActions();

      if (pending.length === 0) {
        this.isProcessing = false;
        return;
      }

      for (const action of pending) {
        try {
          // Playback transaction to specific backend endpoints
          await this.playbackAction(action);
          action.status = "synced";
          await this.updateAction(action);
        } catch (error) {
          logError(error instanceof Error ? error : new Error(String(error)), {
            context: "sync_queue_replay",
            idempotencyKey: action.idempotencyKey,
          });
          action.retryCount++;

          if (action.retryCount >= 5) {
            action.status = "failed"; // Terminate playback on hard failures after 5 retries
          }
          await this.updateAction(action);
        }
      }
    } catch (err) {
      logError(err instanceof Error ? err : new Error(String(err)), {
        context: "sync_queue_process",
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Replays the operation using fetch to our background server routes
   */
  private async playbackAction(action: QueuedAction): Promise<void> {
    const response = await fetch("/api/sync/playback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idempotencyKey: action.idempotencyKey,
        actionType: action.actionType,
        payload: action.payload,
        departmentId: action.departmentId,
      }),
    });

    if (!response.ok) {
      throw new DatabaseError(`Sync queue sync failed`, {
        operation: "sync",
        context: { status: response.status, statusText: response.statusText },
      });
    }
  }
}

// Export singleton instance for app-wide coordination
export const syncQueue = new SyncQueue();
