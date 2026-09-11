"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ClipboardState } from "./types";

/**
 * Hook to copy text to clipboard via navigator.clipboard with auto-reset timeout feedback.
 */
export function useCopyToClipboard(timeoutMs: number = 2000): ClipboardState {
  const [value, setValue] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const reset = useCallback(() => {
    setValue(null);
    setCopied(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      reset();
      if (!navigator?.clipboard) {
        return false;
      }
      try {
        await navigator.clipboard.writeText(text);
        setValue(text);
        setCopied(true);

        timerRef.current = setTimeout(() => {
          setCopied(false);
        }, timeoutMs);

        return true;
      } catch {
        setCopied(false);
        return false;
      }
    },
    [timeoutMs, reset]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { value, copied, copy, reset };
}
