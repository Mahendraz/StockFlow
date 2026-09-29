import { NextResponse } from "next/server";
import { login } from "@/server/auth/auth.service";
import { loginSchema } from "@/server/auth/auth.schemas";
import { setSessionCookie } from "@/server/auth/cookie";
import { handler, parseBody } from "@/server/http";

export const POST = handler(async (req) => {
  const { email, password } = await parseBody(req, loginSchema);
  const { user, session } = await login(email, password);
  const res = NextResponse.json({ user });
  setSessionCookie(res, session.token, session.expiresAt);
  return res;
});
