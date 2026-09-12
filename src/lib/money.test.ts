import { describe, expect, test } from "bun:test";
import {
  bpsOfCents,
  formatBpsAsPercent,
  formatCents,
  formatDollars,
  parseDollarsToCents,
  sumCents,
} from "./money";

describe("money — integer minor-unit helpers", () => {
  test("formatCents formats dollars with sign options", () => {
    expect(formatCents(180000)).toBe("$1,800.00");
    expect(formatCents(123456)).toBe("$1,234.56");
    expect(formatCents(-25000)).toBe("-$250.00");
    expect(formatCents(25000, { signed: true })).toBe("+$250.00");
    expect(formatCents(5)).toBe("$0.05");
    expect(() => formatCents(1.5)).toThrow();
  });

  test("parseDollarsToCents accepts valid entries, rejects floats/invalid text", () => {
    expect(parseDollarsToCents("1800")).toBe(180000);
    expect(parseDollarsToCents("1,800")).toBe(180000);
    expect(parseDollarsToCents("1,800.00")).toBe(180000);
    expect(parseDollarsToCents("0.99")).toBe(99);
    expect(parseDollarsToCents(".99")).toBe(99);
    expect(parseDollarsToCents("12.345")).toBeNull();
    expect(parseDollarsToCents("abc")).toBeNull();
    expect(parseDollarsToCents("-5")).toBeNull();
    expect(parseDollarsToCents("")).toBeNull();
  });

  test("formatDollars uses integer math, no currency symbol", () => {
    expect(formatDollars(123456)).toBe("1,234.56");
    expect(formatDollars(-25000)).toBe("-250.00");
    expect(formatDollars(5)).toBe("0.05");
    expect(() => formatDollars(1.5)).toThrow();
  });

  test("sumCents adds a spread of cents values exactly", () => {
    // 177700 + 3 + 24567 + 1000000 + 123456789 + 42 + 999999999
    expect(sumCents([177700, 3, 24567, 1000000, 123456789, 42, 999999999])).toBe(
      1124659100,
    );
  });

  test("sumCents rejects floats and unsafe values instead of corrupting totals", () => {
    expect(() => sumCents([1.5])).toThrow();
    expect(() => sumCents([Number.MAX_SAFE_INTEGER, 2])).toThrow();
  });

  test("bpsOfCents rounds percentage-of-cents exactly", () => {
    // 10% of $1,832.95 → $183.295 → $183.30
    expect(bpsOfCents(183295, 1000)).toBe(18330);
    // 10% of $2,153.84 → $215.384 → $215.38
    expect(bpsOfCents(215384, 1000)).toBe(21538);
    expect(bpsOfCents(100000, 2299)).toBe(22990);
  });

  test("formatBpsAsPercent has no false precision", () => {
    expect(formatBpsAsPercent(2299)).toBe("22.99%");
    expect(formatBpsAsPercent(1000)).toBe("10%");
    expect(formatBpsAsPercent(505)).toBe("5.05%");
    expect(formatBpsAsPercent(924)).toBe("9.24%");
    expect(formatBpsAsPercent(500)).toBe("5%");
  });
});