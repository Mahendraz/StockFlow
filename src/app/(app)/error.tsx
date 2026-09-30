"use client";

// Error screen for the signed-in pages under (app). It replaces only the page; the nav bar from the layout stays.
// "Retry" calls reset(), which re-renders the page without re-fetching data from the server.

import { ErrorBanner } from "@/components/ui";

// Last-resort boundary so an unexpected render error never leaves a blank screen.
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorBanner message="Something went wrong while showing this page." onRetry={reset} />;
}
