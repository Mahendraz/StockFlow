import { z } from "zod";
import { parseTaxRateBps } from "@/lib/money";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  TAX_RATE: z.string().default("0.11"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema> & { taxRateBps: number };

let cached: Env | undefined;

/**
 * Validated environment. Read lazily (not at import time) so tests can set
 * process.env before the first call, and so a missing variable fails loudly
 * on first use instead of silently defaulting.
 */
export function env(): Env {
  if (!cached) {
    const parsed = envSchema.parse(process.env);
    cached = { ...parsed, taxRateBps: parseTaxRateBps(parsed.TAX_RATE) };
  }
  return cached;
}
