/**
 * Money — deterministic formatting for integer minor units (cents).
 *
 * All financial math in Sumwell happens in integer cents; floats never enter
 * the money path. Formatting is pure and locale-fixed ("en-US", USD) so the
 * output is stable across machines.
 */

const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export type MoneyOptions = {
  /** Prefix with + / - (signed amounts, e.g. deltas). Default false. */
  signed?: boolean;
  /** Compact notation, e.g. $1.8K. Default false. */
  compact?: boolean;
};

/**
 * Format an integer cent amount as USD. Integer math for the common path.
 *
 * - 180000  -> "$1,800.00"
 * - 123456  -> "$1,234.56"
 * - -25000  -> "-$250.00"
 * - signed: 25000 -> "+$250.00"
 */
export function formatCents(cents: number, options: MoneyOptions = {}): string {
  if (!Number.isInteger(cents)) {
    throw new Error(
      `formatCents expects integer minor units, got ${String(cents)}`,
    );
  }
  const { signed = false, compact = false } = options;
  const magnitude = Math.abs(cents);
  // compact display only touches the float for the Intl formatter; the
  // deterministic path below stays on integer math.
  const base = compact
    ? usdCompact.format(magnitude / 100)
    : "$" + formatDollars(magnitude);
  const prefix = cents < 0 ? "-" : signed ? "+" : "";
  return `${prefix}${base}`;
}

/** Parse a user-entered dollar string into integer cents (or null when invalid). */
export function parseDollarsToCents(input: string): number | null {
  const trimmed = input.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed) && !/^\.\d{1,2}$/.test(trimmed)) {
    return null;
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return Number.isSafeInteger(cents) ? cents : null;
}

const usdWhole = new Intl.NumberFormat("en-US", { style: "decimal" });

/**
 * Format integer cents as a plain decimal string with a fixed 2-digit
 * fraction and thousands separators, no currency symbol:
 * - 123456  -> "1,234.56"
 * - -25000  -> "-250.00"
 * - 5       -> "0.05"
 * Integer math only; the float never enters.
 */
export function formatDollars(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new Error(
      `formatDollars expects integer minor units, got ${String(cents)}`,
    );
  }
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${usdWhole.format(whole)}.${frac}`;
}

/**
 * Sum integer cent amounts exactly. Throws on non-integer input or when the
 * running total would leave the safe-integer range, so no float ever slips
 * into the money path.
 */
export function sumCents(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`sumCents expects integer cents, got ${String(value)}`);
    }
    total += value;
    if (!Number.isSafeInteger(total)) {
      throw new Error("sumCents: running total exceeded the safe-integer range");
    }
  }
  return total;
}

/**
 * Exactly round `cents * bps / 10000` to the nearest cent using integer math
 * (bps = 0.01%, so 10000 bps == 100%). Used for percentage-of-income math.
 * - 10% of $1,832.95 => bpsOfCents(183295, 1000) => 18330 ($183.30)
 */
export function bpsOfCents(cents: number, bps: number): number {
  if (!Number.isSafeInteger(cents) || !Number.isSafeInteger(bps)) {
    throw new Error("bpsOfCents expects integer inputs");
  }
  return Math.round((cents * bps) / 10000);
}

/**
 * Format basis points as a percent string with no false precision, integer math:
 * - 2299 -> "22.99%"
 * - 1000 -> "10%"
 * - 505  -> "5.05%"
 */
export function formatBpsAsPercent(bps: number): string {
  if (!Number.isSafeInteger(bps)) {
    throw new Error(`formatBpsAsPercent expects integer bps, got ${String(bps)}`);
  }
  const whole = Math.floor(bps / 100);
  const frac = bps % 100;
  const fracStr = String(frac).padStart(2, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}%` : `${whole}%`;
}