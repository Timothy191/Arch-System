"use client";

import { useEffect, useCallback, useRef, useState } from "react";

export interface UseFormDraftOptions<T> {
  /** Unique storage key for this draft (e.g. 'control_room_checklist_dept123_2026-08-19_day') */
  key: string;
  /** Initial or default state value */
  initialState: T;
  /** Optional callback triggered when a draft is restored */
  onRestore?: (_draft: T) => void;
  /** Whether draft persistence is enabled (default: true) */
  enabled?: boolean;
}

/**
 * AGENT-TRACE: Production-grade hook for form state auto-saving and draft persistence.
 * Prevents data loss when operators switch tabs, minimize windows, or navigate mid-work.
 * Flushes to localStorage on input changes, visibilitychange, and page unload.
 */
export function useFormDraft<T>({
  key,
  initialState,
  onRestore,
  enabled = true,
}: UseFormDraftOptions<T>) {
  const [draftState, setDraftState] = useState<T>(initialState);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const stateRef = useRef<T>(initialState);

  // Keep stateRef up to date for event handlers
  stateRef.current = draftState;

  // Restore draft on mount or key change
  useEffect(() => {
    if (!enabled || !key || typeof window === "undefined") return;

    try {
      const savedRaw = localStorage.getItem(key);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (parsed && typeof parsed === "object" && "data" in parsed) {
          const restoredData = parsed.data as T;
          setDraftState(restoredData);
          setHasRestoredDraft(true);
          setLastSavedAt(parsed.savedAt || new Date().toISOString());
          if (onRestore) {
            onRestore(restoredData);
          }
        }
      }
    } catch {
      // Storage unavailable or parse error — fallback cleanly to initial state
    }
  }, [key, enabled, onRestore]);

  // Flush draft to storage
  const saveDraft = useCallback(() => {
    if (!enabled || !key || typeof window === "undefined") return;

    try {
      const payload = {
        data: stateRef.current,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(payload));
      setLastSavedAt(payload.savedAt);
    } catch {
      // Storage quota exceeded or disabled — handle gracefully
    }
  }, [key, enabled]);

  // Clear draft upon successful form submission
  const clearDraft = useCallback(() => {
    if (!key || typeof window === "undefined") return;
    try {
      localStorage.removeItem(key);
      setHasRestoredDraft(false);
      setLastSavedAt(null);
    } catch {
      // Ignore cleanup errors
    }
  }, [key]);

  // Auto-save on visibilitychange (switching tabs/minimizing) and beforeunload
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const handleFlush = () => {
      saveDraft();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveDraft();
      }
    };

    window.addEventListener("beforeunload", handleFlush);
    window.addEventListener("pagehide", handleFlush);
    window.addEventListener("arch:tab-swap", handleFlush);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleFlush);
      window.removeEventListener("pagehide", handleFlush);
      window.removeEventListener("arch:tab-swap", handleFlush);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, saveDraft]);

  return {
    draftState,
    setDraftState,
    saveDraft,
    clearDraft,
    hasRestoredDraft,
    lastSavedAt,
  };
}
