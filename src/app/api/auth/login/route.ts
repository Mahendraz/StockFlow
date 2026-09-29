import { NextResponse } from "next/server";
import { login } from "@/server/auth/auth.service";
import { loginSchema } from "@/server/auth/auth.schemas";
import { setSessionCookie } from "@/server/auth/cookie";
import { assertLoginAllowed, clearLoginFailures, clientIp, recordLoginFailure } from "@/server/auth/rate-limit";
import { AppError } from "@/server/errors";
import { handler, parseBody } from "@/server/http";

export const POST = handler(async (req) => {
  const { email, password } = await parseBody(req, loginSchema);
  const rateKey = `${clientIp(req.headers)}|${email}`;
  assertLoginAllowed(rateKey);

  try {
    const { user, session } = await login(email, password);
    clearLoginFailures(rateKey);
    const res = NextResponse.json({ user });
    setSessionCookie(res, session.token, session.expiresAt);
    return res;
  } catch (err) {
    if (err instanceof AppError && err.code === "INVALID_CREDENTIALS") recordLoginFailure(rateKey);
    throw err;
  }
});
