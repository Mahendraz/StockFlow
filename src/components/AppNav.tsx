"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

const links = [
  { href: "/products", label: "Products" },
  { href: "/invoices", label: "Invoices" },
];

export function AppNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      queryClient.clear(); // drop the previous user's cached data
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <span className="font-semibold">StockFlow</span>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`text-sm ${pathname.startsWith(l.href) ? "font-medium text-blue-700" : "text-slate-600 hover:text-slate-900"}`}
          >
            {l.label}
          </Link>
        ))}
        <span className="ml-auto hidden text-sm text-slate-500 sm:inline">{email}</span>
        <button type="button" className="btn" onClick={logout} disabled={loggingOut}>
          {loggingOut ? "Logging out…" : "Log out"}
        </button>
      </nav>
    </header>
  );
}
