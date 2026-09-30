import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "StockFlow",
  description: "Minimal inventory and invoicing",
};

/** Root layout around every page: loads global CSS and wraps the app in <Providers> (the React Query cache). */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
