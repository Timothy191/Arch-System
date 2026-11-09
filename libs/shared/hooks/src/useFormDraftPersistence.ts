'use client';

import { useCallback, useEffect } from 'react';

/**
 * Registers browser lifecycle listeners (`beforeunload`, `pagehide`, `arch:tab-swap`,
 * `visibilitychange`) to flush an in-progress form draft to `localStorage`, and
 * returns a safe `clearDraft()` helper.
 */
export function useFormDraftPersistence(
  draftKey: string,
  saveDraft: () => void
): { clearDraft: () => void } {
  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // Ignore cleanup error
    }
  }, [draftKey]);

  useEffect(() => {
    saveDraft();
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        saveDraft();
      }
    };
    window.addEventListener('beforeunload', saveDraft);
    window.addEventListener('pagehide', saveDraft);
    window.addEventListener('arch:tab-swap', saveDraft);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('beforeunload', saveDraft);
      window.removeEventListener('pagehide', saveDraft);
      window.removeEventListener('arch:tab-swap', saveDraft);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [saveDraft]);

  return { clearDraft };
}
