// Shared test helpers: build requests for the route handlers and sign up users with a real session.

import { NextRequest } from "next/server";
import { POST as registerRoute } from "@/app/api/auth/register/route";
import { SESSION_COOKIE } from "@/server/auth/cookie";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

/** Builds a request the way the browser would send it to a route handler. */
export function makeRequest(method: Method, path: string, opts: { body?: unknown; cookie?: string } = {}) {
  const headers = new Headers();
  if (opts.body !== undefined) headers.set("content-type", "application/json");
  if (opts.cookie) headers.set("cookie", `${SESSION_COOKIE}=${opts.cookie}`);
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

/** Route context for handlers under a dynamic [id] segment. */
export const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });

/** Reads the session token out of a response's Set-Cookie header ("" when it was cleared). */
export function sessionFrom(res: Response): string | undefined {
  const header = res.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return header?.slice(SESSION_COOKIE.length + 1).split(";")[0];
}

// Keeps the default signUp() emails unique.
let counter = 0;

/** Registers a fresh user and returns their session token. */
export async function signUp(email = `user${++counter}@example.com`, password = "correct-horse-1") {
  const res = await registerRoute(makeRequest("POST", "/api/auth/register", { body: { email, password } }), undefined);
  if (res.status !== 201) throw new Error(`signUp failed: ${res.status} ${await res.text()}`);
  return { email, password, cookie: sessionFrom(res)! };
}
