import { NextResponse } from "next/server";
import { getPublicUser } from "@/server/auth/auth.service";
import { authedHandler } from "@/server/http";

// GET /api/auth/me: returns the signed-in user's id and email (401 without a valid session).
export const GET = authedHandler(async (_req, _ctx, user) => {
  return NextResponse.json({ user: await getPublicUser(user) });
});
