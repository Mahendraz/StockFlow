import mongoose from "mongoose";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type z } from "zod";
import { MoneyError } from "@/lib/money";
import { clearSessionCookie, SESSION_COOKIE } from "./auth/cookie";
import { requireUser, type AuthUser } from "./auth/auth.service";
import { connectDb } from "./db";
import { AppError, badRequest, type FieldErrors } from "./errors";

/** Every error response has this shape: { "error": { "code", "message", "fields"? } } */
export function errorResponse(status: number, code: string, message: string, fields?: FieldErrors) {
  return NextResponse.json({ error: { code, message, ...(fields && { fields }) } }, { status });
}

function zodFieldErrors(err: ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_root";
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

function isDuplicateKeyError(err: unknown): err is { code: 11000; keyPattern?: Record<string, unknown> } {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === 11000;
}

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof AppError) return errorResponse(err.status, err.code, err.message, err.fields);

  if (err instanceof ZodError) return errorResponse(422, "VALIDATION_ERROR", "Validation failed", zodFieldErrors(err));

  if (err instanceof MoneyError) return errorResponse(422, "VALIDATION_ERROR", err.message);

  if (isDuplicateKeyError(err)) {
    // Unique indexes are compound with userId; report the user-facing field.
    const field = Object.keys(err.keyPattern ?? {}).find((k) => k !== "userId") ?? "value";
    return errorResponse(409, "DUPLICATE", `A record with this ${field} already exists`, {
      [field]: [`${field} must be unique`],
    });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const fields: FieldErrors = {};
    for (const [path, e] of Object.entries(err.errors)) fields[path] = [e.message];
    return errorResponse(422, "VALIDATION_ERROR", "Validation failed", fields);
  }

  // Unexpected: log the details server-side, never send them to the client.
  console.error(err);
  return errorResponse(500, "INTERNAL_ERROR", "Something went wrong");
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/** Wraps a route handler: connects to the DB and turns thrown errors into JSON error responses. */
export function handler<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      await connectDb();
      return await fn(req, ctx);
    } catch (err) {
      const res = toErrorResponse(err);
      // A request carrying a dead session cookie gets it cleared.
      if (res.status === 401 && req.cookies.has(SESSION_COOKIE)) clearSessionCookie(res);
      return res;
    }
  };
}

/** Like `handler`, but rejects the request with 401 unless it carries a valid session. */
export function authedHandler<C = unknown>(
  fn: (req: NextRequest, ctx: C, user: AuthUser) => Promise<Response>,
): Handler<C> {
  return handler<C>(async (req, ctx) => fn(req, ctx, await requireUser(req.cookies.get(SESSION_COOKIE)?.value)));
}

export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON", "INVALID_JSON");
  }
  return schema.parse(body);
}

export function parseQuery<S extends z.ZodType>(req: NextRequest, schema: S): z.output<S> {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams));
}

/** Route context for dynamic segments such as /api/products/[id]. */
export type IdContext = { params: Promise<{ id: string }> };
