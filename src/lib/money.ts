/**
 * Money — deterministic formatting for integer minor units (cents).
 *
 * All financial math in Sumwell happens in integer cents; floats never enter
 * the money path. Formatting is pure and locale-fixed ("en-US", USD) so the
 * output is stable across machines.
 */

const usdFull = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

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
 * Format an integer cent amount as USD.
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
  const base = compact ? usdCompact.format(magnitude) : usdFull.format(magnitude);
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