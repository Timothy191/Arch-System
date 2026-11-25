'use client';

import type { RemoteSupportSessionStatus, RemoteSupportTier } from '@repo/contract';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

const SESSION_STORAGE_KEY = 'arch-remote-support-session-v1';

export interface ActiveRemoteSupportSession {
  readonly sessionId: string;
  readonly sessionCode: string;
  readonly tier: RemoteSupportTier;
  readonly status: RemoteSupportSessionStatus;
  readonly issueSummary: string;
  readonly agentName: string | null;
  readonly agentRole: string | null;
  readonly deviceName: string | null;
  readonly cobrowseEnabled: boolean;
  readonly cobrowsePendingRequest: boolean;
  readonly expiresAt: string;
}

interface RemoteSupportStoreState {
  readonly activeSession: ActiveRemoteSupportSession | null;
  readonly setActiveSession: (session: ActiveRemoteSupportSession | null) => void;
  readonly patchActiveSession: (patch: Partial<ActiveRemoteSupportSession>) => void;
  readonly clearActiveSession: () => void;
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

function resolveSessionStorage(): StateStorage {
  if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
    return window.sessionStorage;
  }
  return noopStorage;
}

export const useRemoteSupportStore = create<RemoteSupportStoreState>()(
  persist(
    (set) => ({
      activeSession: null,
      setActiveSession: (activeSession) => set({ activeSession }),
      patchActiveSession: (patch) =>
        set((state) => ({
          activeSession: state.activeSession ? { ...state.activeSession, ...patch } : null,
        })),
      clearActiveSession: () => set({ activeSession: null }),
    }),
    {
      name: SESSION_STORAGE_KEY,
      storage: createJSONStorage(resolveSessionStorage),
    }
  )
);
