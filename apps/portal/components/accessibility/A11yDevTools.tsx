"use client";

import { useEffect } from "react";

/**
 * Development-only axe-core accessibility checker.
 * Automatically runs accessibility audits in development mode.
 * This component should only be mounted in development.
 */
export function A11yDevTools() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const initAxe = async () => {
      try {
        const axeModule = await import("@axe-core/react");
        const React = await import("react");
        const ReactDOM = await import("react-dom/client");

        if (typeof axeModule.default === "function") {
          axeModule.default(React, ReactDOM, 1000, {
            rules: [{ id: "color-contrast", enabled: true }],
          });
          // eslint-disable-next-line no-console
          console.info("[A11y] axe-core initialized for accessibility testing");
        }
      } catch {
        // axe-core not available in this environment
      }
    };

    void initAxe();
  }, []);

  return null;
}
