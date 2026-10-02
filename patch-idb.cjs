const fs = require('fs');
const file = 'libs/shared/hooks/src/useOfflineQueue.ts';
let code = fs.readFileSync(file, 'utf8');

// add import
code = code.replace(
  "import { persist } from 'zustand/middleware';",
  "import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';\nimport { get, set, del } from 'idb-keyval';"
);

// create storage
const storageCode = `
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};
`;
code = code.replace('const compareHlc', storageCode + '\nconst compareHlc');

// apply storage
code = code.replace(
  "name: 'arch-offline-queue',",
  "name: 'arch-offline-queue',\n      storage: createJSONStorage(() => idbStorage),"
);

fs.writeFileSync(file, code);
