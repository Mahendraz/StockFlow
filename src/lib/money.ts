/**
 * Money helpers. All amounts are INTEGER MINOR UNITS (1/100 of the currency unit),
 * so "Rp 12,500.50" is stored as 1250050. No floating-point arithmetic is ever
 * used on amounts. Shared by server (authoritative math) and client (display only).
 */

export const MINOR_UNITS_PER_MAJOR = 100;

/** Thrown for an invalid or too-large amount; the API turns it into a 422. */
export class MoneyError extends Error {}

/** Throws unless `value` is a non-negative safe integer. */
export function assertMinor(value: number, label = "amount"): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new MoneyError(`${label} must be a non-negative integer amount in minor units`);
  }
  return value;
}

/** unitPrice × quantity, refusing results outside the safe-integer range. */
export function multiply(unitPrice: number, quantity: number): number {
  const result = BigInt(unitPrice) * BigInt(quantity);
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new MoneyError("Amount is too large");
  return Number(result);
}

/** Adds amounts with BigInt; throws MoneyError if the total is above Number.MAX_SAFE_INTEGER. */
export function sum(values: number[]): number {
  const result = values.reduce((acc, v) => acc + BigInt(v), BigInt(0));
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new MoneyError("Amount is too large");
  return Number(result);
}

/**
 * Tax on a subtotal, with the rate in basis points (11% = 1100).
 * Rounds half-up to the nearest minor unit using integer math only.
 */
export function taxFor(subtotal: number, rateBps: number): number {
  const scaled = BigInt(subtotal) * BigInt(rateBps);
  // BigInt division drops the fraction; adding half the divisor (5000) first makes it round half-up.
  return Number((scaled + BigInt(5000)) / BigInt(10000));
}

/**
 * Parses a decimal fraction string such as "0.11" into basis points (1100)
 * by string manipulation, never by multiplying a float.
 */
export function parseTaxRateBps(raw: string): number {
  const match = /^(0|1)(?:\.(\d{1,4}))?$/.exec(raw.trim());
  if (!match) throw new MoneyError(`Invalid tax rate "${raw}": use a fraction like 0.11 (max 4 decimals)`);
  // "0.11" → 0 × 10000 + "11" padded to "1100" = 1100 basis points.
  const bps = Number(match[1]) * 10000 + Number((match[2] ?? "").padEnd(4, "0"));
  if (bps > 10000) throw new MoneyError(`Invalid tax rate "${raw}": must be between 0 and 1`);
  return bps;
}

/** "12500.5" / "12,500.50" → 1250050. Returns null for anything that is not a valid amount. */
export function parseMajorInput(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const value = BigInt(match[1]) * BigInt(MINOR_UNITS_PER_MAJOR) + BigInt((match[2] ?? "").padEnd(2, "0"));
  return value > BigInt(Number.MAX_SAFE_INTEGER) ? null : Number(value);
}

/** 1250050 → "12,500.50" (integer formatting, no float division). */
export function formatMinor(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = BigInt(Math.abs(minor));
  const major = abs / BigInt(MINOR_UNITS_PER_MAJOR);
  const cents = (abs % BigInt(MINOR_UNITS_PER_MAJOR)).toString().padStart(2, "0");
  return `${sign}${major.toLocaleString("en-US")}.${cents}`;
}

/** Formats basis points as a percentage label: 1100 → "11%", 1150 → "11.5%". */
export function formatRateBps(bps: number): string {
  const whole = Math.trunc(bps / 100);
  const frac = String(bps % 100).padStart(2, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}%` : `${whole}%`;
}
