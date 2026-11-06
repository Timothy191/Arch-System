'use client';

import { createContext, type ReactNode, useContext, useEffect } from 'react';

interface ArchThemeContextType {
  theme: 'light';
  resolvedTheme: 'light';
}
const ArchThemeContext = createContext<ArchThemeContextType | undefined>(undefined);

const LIGHT_THEME = {
  theme: 'light' as const,
  resolvedTheme: 'light' as const,
};

/**
 * ArchThemeProvider — Light-only theme provider for the Arch System.
 *
 * Sets `data-theme="light"` and `<meta name="theme-color">` on mount.
 * No dark mode; no next-themes dependency.
 */
export function ArchThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', '#f3f4f6');
    }
  }, []);

  return <ArchThemeContext.Provider value={LIGHT_THEME}>{children}</ArchThemeContext.Provider>;
}

export function useArchTheme() {
  const ctx = useContext(ArchThemeContext);
  if (!ctx) {
    throw new Error('useArchTheme must be used within an ArchThemeProvider');
  }
  return ctx;
}
