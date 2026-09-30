import { NextResponse } from "next/server";
import { register } from "@/server/auth/auth.service";
import { registerSchema } from "@/server/auth/auth.schemas";
import { setSessionCookie } from "@/server/auth/cookie";
import { handler, parseBody } from "@/server/http";

// POST /api/auth/register: creates the account and signs it in (201 + session cookie); 409 if the email is taken.
export const POST = handler(async (req) => {
  const { email, password } = await parseBody(req, registerSchema);
  const { user, session } = await register(email, password);
  const res = NextResponse.json({ user }, { status: 201 });
  setSessionCookie(res, session.token, session.expiresAt);
  return res;
});
