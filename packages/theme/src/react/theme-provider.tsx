"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  ThemeProvider as NextThemesProvider,
  useTheme as useNextThemes,
} from "next-themes";

interface ArchThemeContextType {
  theme: "light";
  resolvedTheme: "light";
  setTheme: () => void;
  toggleTheme: () => void;
}

const ArchThemeContext = createContext<ArchThemeContextType | undefined>(
  undefined,
);

/**
 * ArchThemeProvider — Light-only theme provider for the Arch System.
 *
 * Defaults to light. No dark mode support.
 * Syncs `data-theme="light"` and updates `<meta name="theme-color">`.
 */
export function ArchThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      forcedTheme="light"
      enableSystem={false}
      enableColorScheme={false}
    >
      <ArchThemeInner>{children}</ArchThemeInner>
    </NextThemesProvider>
  );
}

function ArchThemeInner({ children }: { children: ReactNode }) {
  useNextThemes();

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", "light");

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", "#f5f5f7");
    }
  }, []);

  const toggleTheme = useCallback(() => {
    // No-op: light only
  }, []);

  return (
    <ArchThemeContext.Provider
      value={{
        theme: "light",
        resolvedTheme: "light",
        setTheme: () => {},
        toggleTheme,
      }}
    >
      {children}
    </ArchThemeContext.Provider>
  );
}

export function useArchTheme() {
  const ctx = useContext(ArchThemeContext);
  if (!ctx) {
    throw new Error("useArchTheme must be used within an ArchThemeProvider");
  }
  return ctx;
}

export { useNextThemes as useTheme };
