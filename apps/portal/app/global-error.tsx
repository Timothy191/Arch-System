"use client";

import { useEffect } from "react";
import RootError from "./error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console in development; Sentry is initialized via instrumentation.ts
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("Global error:", error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body>
        <RootError error={error} reset={reset} />
      </body>
    </html>
  );
}
