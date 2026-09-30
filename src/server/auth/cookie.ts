// The session cookie: its name and the flags it is set and cleared with.

import type { NextResponse } from "next/server";

/** Name of the cookie that holds the session token. */
export const SESSION_COOKIE = "sf_session";

/**
 * httpOnly: JavaScript (and therefore XSS) cannot read the token.
 * SameSite=Lax: the browser does not attach it to cross-site POST/PATCH/DELETE requests (CSRF).
 * Secure in production: only sent over HTTPS.
 */
export function setSessionCookie(res: NextResponse, token: string, expiresAt: Date): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Deletes the session cookie in the browser (empty value, maxAge 0), using the same flags it was set with. */
export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
