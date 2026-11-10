export const DRAFT_DB_NAME = 'arch_drafts_db';
export const DRAFT_STORE_NAME = 'form_drafts';
export const DRAFT_DB_VERSION = 1;

const READWRITE_MODE: IDBTransactionMode = 'readwrite';
const READONLY_MODE: IDBTransactionMode = 'readonly';

function isIndexedDbSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function writeLocalStorageFallback(draftKey: string, serializedPayload: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(draftKey, serializedPayload);
  } catch {
    // Quota or private-browsing error; fallback best-effort
  }
}

function readLocalStorageFallback(draftKey: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(draftKey);
  } catch {
    return null;
  }
}

function removeLocalStorageFallback(draftKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(draftKey);
  } catch {
    // Ignore storage removal errors in restricted environments
  }
}

function openDraftDatabase(): Promise<IDBDatabase | null> {
  if (!isIndexedDbSupported()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const openRequest = window.indexedDB.open(DRAFT_DB_NAME, DRAFT_DB_VERSION);

      openRequest.onupgradeneeded = () => {
        const database = openRequest.result;
        if (!database.objectStoreNames.contains(DRAFT_STORE_NAME)) {
          database.createObjectStore(DRAFT_STORE_NAME);
        }
      };

      openRequest.onsuccess = () => {
        resolve(openRequest.result);
      };

      openRequest.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

function putDraftInStore(
  database: IDBDatabase,
  entry: { draftKey: string; serializedPayload: string }
): Promise<void> {
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(DRAFT_STORE_NAME, READWRITE_MODE);
      const store = transaction.objectStore(DRAFT_STORE_NAME);
      const putRequest = store.put(entry.serializedPayload, entry.draftKey);

      putRequest.onsuccess = () => {
        database.close();
        resolve();
      };

      putRequest.onerror = () => {
        database.close();
        resolve();
      };
    } catch {
      database.close();
      resolve();
    }
  });
}

function getDraftFromStore(database: IDBDatabase, draftKey: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(DRAFT_STORE_NAME, READONLY_MODE);
      const store = transaction.objectStore(DRAFT_STORE_NAME);
      const getRequest = store.get(draftKey);

      getRequest.onsuccess = () => {
        const storedPayload = typeof getRequest.result === 'string' ? getRequest.result : null;
        database.close();
        resolve(storedPayload);
      };

      getRequest.onerror = () => {
        database.close();
        resolve(null);
      };
    } catch {
      database.close();
      resolve(null);
    }
  });
}

function deleteDraftFromStore(database: IDBDatabase, draftKey: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(DRAFT_STORE_NAME, READWRITE_MODE);
      const store = transaction.objectStore(DRAFT_STORE_NAME);
      const deleteRequest = store.delete(draftKey);

      deleteRequest.onsuccess = () => {
        database.close();
        resolve();
      };

      deleteRequest.onerror = () => {
        database.close();
        resolve();
      };
    } catch {
      database.close();
      resolve();
    }
  });
}

export async function saveDraftToStorage(
  draftKey: string,
  serializedPayload: string
): Promise<void> {
  writeLocalStorageFallback(draftKey, serializedPayload);
  const database = await openDraftDatabase();
  if (!database) return;
  await putDraftInStore(database, { draftKey, serializedPayload });
}

export async function loadDraftFromStorage(draftKey: string): Promise<string | null> {
  const database = await openDraftDatabase();
  if (database) {
    const indexedDbPayload = await getDraftFromStore(database, draftKey);
    if (indexedDbPayload !== null) {
      return indexedDbPayload;
    }
  }
  return readLocalStorageFallback(draftKey);
}

export async function removeDraftFromStorage(draftKey: string): Promise<void> {
  removeLocalStorageFallback(draftKey);
  const database = await openDraftDatabase();
  if (!database) return;
  await deleteDraftFromStore(database, draftKey);
}
