import { AppError } from "../errors";

/**
 * Login throttling: at most MAX_FAILURES failed logins per (IP, email) in a sliding
 * WINDOW_MS window, then 429 until the oldest failure ages out. A successful login clears
 * the counter. Keying on IP + email means an attacker cannot lock a real user out from
 * another network by spamming their email.
 *
 * In-memory, so it is per server process: fine for one instance, but several instances
 * would each count separately (a shared store such as Redis would fix that).
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

const failures = new Map<string, number[]>();

export class RateLimitError extends AppError {
  constructor(readonly retryAfterSeconds: number) {
    super(429, "RATE_LIMITED", `Too many failed login attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`);
  }
}

/** Client IP as seen by the app. X-Forwarded-For is only trustworthy behind a proxy that sets it. */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
}

function recent(key: string, now: number): number[] {
  const list = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length > 0) failures.set(key, list);
  else failures.delete(key);
  return list;
}

export function assertLoginAllowed(key: string, now = Date.now()): void {
  const list = recent(key, now);
  if (list.length >= MAX_FAILURES) {
    throw new RateLimitError(Math.ceil((list[0] + WINDOW_MS - now) / 1000));
  }
}

export function recordLoginFailure(key: string, now = Date.now()): void {
  failures.set(key, [...recent(key, now), now]);
}

export function clearLoginFailures(key: string): void {
  failures.delete(key);
}

/** Test helper. */
export function resetLoginRateLimits(): void {
  failures.clear();
}

export const LOGIN_RATE_LIMIT = { WINDOW_MS, MAX_FAILURES };
