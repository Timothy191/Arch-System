"use client";

import { useEffect } from "react";
import { useFocusMode } from "@/hooks/useFocusMode";

interface FocusModeProviderProps {
  children: React.ReactNode;
}

export function FocusModeProvider({ children }: FocusModeProviderProps) {
  const enabled = useFocusMode((s) => s.enabled);

  useEffect(() => {
    if (enabled) {
      document.body.classList.add("focus-mode");
    } else {
      document.body.classList.remove("focus-mode");
    }
    return () => {
      document.body.classList.remove("focus-mode");
    };
  }, [enabled]);

  return <>{children}</>;
}
