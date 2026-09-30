/**
 * Browser-side fetch wrapper for the JSON API. Every non-2xx answer becomes an ApiError
 * carrying the server's { code, message, fields } so forms can show them as-is.
 */
export type FieldErrors = Record<string, string[]>;

/** Thrown by api() for a failed request: HTTP status (0 = network failure), error code and per-field messages. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: FieldErrors = {},
  ) {
    super(message);
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

/**
 * Calls the JSON API (the browser attaches the session cookie) and returns the parsed body, or undefined for 204.
 * Throws ApiError on a non-2xx answer or a network failure; a 401 from a non-auth endpoint also redirects to /login.
 */
export async function api<T = unknown>(path: string, options: { method?: Method; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method ?? "GET",
      headers: options.body === undefined ? undefined : { "content-type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    // Session expired or revoked while using the app: go back to login, then return here.
    if (res.status === 401 && !path.startsWith("/api/auth/")) {
      const here = window.location.pathname + window.location.search;
      // A full page load on purpose: it drops every cached query of the expired session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/login?next=${encodeURIComponent(here)}`);
    }
    const error = json?.error ?? {};
    throw new ApiError(res.status, error.code ?? "UNKNOWN", error.message ?? `Request failed (${res.status})`, error.fields);
  }
  return json as T;
}

/** Text to show for any caught error, with a generic fallback. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

/** Per-field messages from an ApiError (keys like "items.0.quantity"), or {} for any other error. */
export function fieldErrors(err: unknown): FieldErrors {
  return err instanceof ApiError ? err.fields : {};
}
