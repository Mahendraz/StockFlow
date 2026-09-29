/**
 * Where to go after login. Only same-site paths are allowed ("/invoices?status=DRAFT"),
 * never "//evil.example" or "https://…", so the login page cannot be used as an open redirect.
 */
export function safeNextPath(next: string | string[] | undefined): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/products";
  }
  return next;
}
