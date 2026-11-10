import {
  DRAFT_DB_NAME,
  DRAFT_DB_VERSION,
  DRAFT_STORE_NAME,
  loadDraftFromStorage,
  removeDraftFromStorage,
  saveDraftToStorage,
} from './indexeddb-draft-storage';

function createMockIndexedDb(backingMap: Map<string, string>) {
  const mockStore = {
    put: jest.fn((serializedPayload: string, draftKey: string) => {
      const request: { onsuccess?: () => void; onerror?: () => void } = {};
      Promise.resolve().then(() => {
        backingMap.set(draftKey, serializedPayload);
        request.onsuccess?.();
      });
      return request;
    }),
    get: jest.fn((draftKey: string) => {
      const request: { result?: string; onsuccess?: () => void; onerror?: () => void } = {};
      Promise.resolve().then(() => {
        request.result = backingMap.get(draftKey);
        request.onsuccess?.();
      });
      return request;
    }),
    delete: jest.fn((draftKey: string) => {
      const request: { onsuccess?: () => void; onerror?: () => void } = {};
      Promise.resolve().then(() => {
        backingMap.delete(draftKey);
        request.onsuccess?.();
      });
      return request;
    }),
  };

  const mockDatabase = {
    objectStoreNames: {
      contains: jest.fn(() => false),
    },
    createObjectStore: jest.fn(),
    transaction: jest.fn(() => ({
      objectStore: jest.fn(() => mockStore),
    })),
    close: jest.fn(),
  };

  const open = jest.fn(() => {
    const openRequest: {
      result?: typeof mockDatabase;
      onupgradeneeded?: () => void;
      onsuccess?: () => void;
      onerror?: () => void;
    } = {
      result: mockDatabase,
    };
    Promise.resolve().then(() => {
      openRequest.onupgradeneeded?.();
      openRequest.onsuccess?.();
    });
    return openRequest;
  });

  return { open, mockDatabase, mockStore };
}

describe('Given indexeddb-draft-storage persistence utilities', () => {
  const sampleKey = 'arch_daily_log_draft_dept_1';
  const samplePayload = JSON.stringify({ shift: 'day', notes: 'Primary crusher inspection OK' });

  beforeEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it('When IndexedDB is unavailable, Then save, load, and remove fall back to localStorage', async () => {
    Object.defineProperty(window, 'indexedDB', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    await saveDraftToStorage(sampleKey, samplePayload);
    expect(window.localStorage.getItem(sampleKey)).toBe(samplePayload);

    const loadedPayload = await loadDraftFromStorage(sampleKey);
    expect(loadedPayload).toBe(samplePayload);

    await removeDraftFromStorage(sampleKey);
    expect(window.localStorage.getItem(sampleKey)).toBeNull();
    expect(await loadDraftFromStorage(sampleKey)).toBeNull();
  });

  it('When IndexedDB is available, Then save writes to both IndexedDB and localStorage and load reads from IndexedDB first', async () => {
    const backingMap = new Map<string, string>();
    const { open, mockDatabase, mockStore } = createMockIndexedDb(backingMap);

    Object.defineProperty(window, 'indexedDB', {
      value: { open },
      configurable: true,
      writable: true,
    });

    await saveDraftToStorage(sampleKey, samplePayload);

    expect(open).toHaveBeenCalledWith(DRAFT_DB_NAME, DRAFT_DB_VERSION);
    expect(mockDatabase.createObjectStore).toHaveBeenCalledWith(DRAFT_STORE_NAME);
    expect(mockStore.put).toHaveBeenCalledWith(samplePayload, sampleKey);
    expect(window.localStorage.getItem(sampleKey)).toBe(samplePayload);

    // Clear localStorage to prove loadDraftFromStorage resolves from IndexedDB
    window.localStorage.removeItem(sampleKey);
    const loadedFromIndexedDb = await loadDraftFromStorage(sampleKey);
    expect(loadedFromIndexedDb).toBe(samplePayload);

    await removeDraftFromStorage(sampleKey);
    expect(mockStore.delete).toHaveBeenCalledWith(sampleKey);
    expect(backingMap.has(sampleKey)).toBe(false);
  });
});
