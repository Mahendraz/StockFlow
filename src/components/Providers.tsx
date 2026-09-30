"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "@/lib/api-client";

/** Gives the whole app one shared React Query cache. Mounted once, in the root layout. */
export function Providers({ children }: { children: React.ReactNode }) {
  // useState keeps the same client across re-renders instead of creating a new cache each time.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Retry only network/server hiccups, never 4xx answers.
            retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
            // Don't refetch just because the browser tab gets focus again.
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
