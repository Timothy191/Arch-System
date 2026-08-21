"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function ReactQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // SSR friendly settings
            // AGENT-TRACE: Increased staleTime to 5 min to reduce unnecessary refetches.
            // Most department data changes infrequently; per-query overrides handle
            // real-time needs (e.g., AIMetricsDashboard uses refetchInterval: 30s).
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: 2,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
