import { describe, expect, it } from "vitest";
import { computeTotals } from "@/lib/invoice-totals";
import { canTransition } from "@/lib/invoice-status";
import { formatMinor, formatRateBps, parseMajorInput, parseTaxRateBps, taxFor } from "@/lib/money";

describe("money (integer minor units)", () => {
  it("parses tax rates into basis points without float math", () => {
    expect(parseTaxRateBps("0.11")).toBe(1100);
    expect(parseTaxRateBps("0.075")).toBe(750);
    expect(parseTaxRateBps("0")).toBe(0);
    expect(parseTaxRateBps("1")).toBe(10000);
    expect(() => parseTaxRateBps("1.5")).toThrow();
    expect(() => parseTaxRateBps("11%")).toThrow();
    expect(() => parseTaxRateBps("0.12345")).toThrow();
  });

  it("rounds tax half-up to the nearest minor unit", () => {
    expect(taxFor(50, 1100)).toBe(6); // 5.5 → 6
    expect(taxFor(40, 1100)).toBe(4); // 4.4 → 4
    expect(taxFor(0, 1100)).toBe(0);
  });

  it("avoids the classic float error: 0.1 + 0.2", () => {
    const { subtotal } = computeTotals(
      [
        { unitPrice: 10, quantity: 1 },
        { unitPrice: 20, quantity: 1 },
      ],
      0,
    );
    expect(subtotal).toBe(30);
    expect(formatMinor(subtotal)).toBe("0.30");
  });

  it("parses and formats user-facing amounts", () => {
    expect(parseMajorInput("12,500.5")).toBe(1250050);
    expect(parseMajorInput("7")).toBe(700);
    expect(parseMajorInput("1.234")).toBeNull();
    expect(parseMajorInput("-1")).toBeNull();
    expect(formatMinor(1250050)).toBe("12,500.50");
    expect(formatRateBps(1100)).toBe("11%");
    expect(formatRateBps(1150)).toBe("11.5%");
  });
});

describe("invoice status machine", () => {
  it("allows exactly the documented transitions", () => {
    expect(canTransition("DRAFT", "ISSUED")).toBe(true);
    expect(canTransition("DRAFT", "CANCELLED")).toBe(true);
    expect(canTransition("ISSUED", "PAID")).toBe(true);
    expect(canTransition("ISSUED", "CANCELLED")).toBe(true);
    expect(canTransition("DRAFT", "PAID")).toBe(false);
    expect(canTransition("PAID", "CANCELLED")).toBe(false);
    expect(canTransition("CANCELLED", "DRAFT")).toBe(false);
    expect(canTransition("ISSUED", "DRAFT")).toBe(false);
  });
});
