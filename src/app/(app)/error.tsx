"use client";

import { ErrorBanner } from "@/components/ui";

// Last-resort boundary so an unexpected render error never leaves a blank screen.
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorBanner message="Something went wrong while showing this page." onRetry={reset} />;
}
