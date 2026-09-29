import { NextResponse } from "next/server";
import { getPublicUser } from "@/server/auth/auth.service";
import { authedHandler } from "@/server/http";

export const GET = authedHandler(async (_req, _ctx, user) => {
  return NextResponse.json({ user: await getPublicUser(user) });
});
