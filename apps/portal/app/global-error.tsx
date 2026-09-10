"use client";

// AGENT-TRACE: global-error.tsx is intentionally self-contained with no @repo/ui
// imports. It renders outside any layout (Next.js wraps it in a minimal html/body),
// so it cannot inherit fonts, design tokens, or the layout chunk. Previously it
// re-imported RootError which pulled framer-motion + @repo/ui into a 1.26 MiB
// chunk. Inline styles ensure it works even if CSS fails to load.
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("Global error:", error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#f3f4f6",
        }}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              maxWidth: "28rem",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <h1
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  color: "#111827",
                  margin: 0,
                }}
                role="alert"
                aria-live="assertive"
              >
                Something went wrong
              </h1>
              <p style={{ color: "#6b7280", margin: 0, fontSize: "0.875rem" }}>
                {process.env.NODE_ENV === "development"
                  ? error.message
                  : "An unexpected error occurred. Please try again."}
              </p>
              {error.digest && (
                <p
                  style={{
                    color: "#9ca3af",
                    margin: 0,
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                  }}
                >
                  Error ID: {error.digest}
                </p>
              )}
            </div>
            <button
              onClick={reset}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "0.5rem",
                border: "1px solid #d1d5db",
                background: "#ffffff",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#374151",
                alignSelf: "center",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
