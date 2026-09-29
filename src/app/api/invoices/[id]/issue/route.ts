import { NextResponse } from "next/server";
import { authedHandler, type IdContext } from "@/server/http";
import { changeStatus } from "@/server/invoices/invoice.service";

// DRAFT → ISSUED; decrements stock for every line atomically.
export const POST = authedHandler<IdContext>(async (_req, ctx, user) => {
  const { id } = await ctx.params;
  return NextResponse.json({ data: await changeStatus(user.id, id, "ISSUED") });
});
