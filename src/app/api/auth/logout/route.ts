import { NextResponse } from "next/server";
import { logout } from "@/server/auth/auth.service";
import { clearSessionCookie, SESSION_COOKIE } from "@/server/auth/cookie";
import { handler } from "@/server/http";

// Idempotent: logging out without a (valid) session still succeeds.
export const POST = handler(async (req) => {
  await logout(req.cookies.get(SESSION_COOKIE)?.value);
  const res = new NextResponse(null, { status: 204 });
  clearSessionCookie(res);
  return res;
});
