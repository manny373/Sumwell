/**
 * Duplicate review for existing transactions — Phase 3c.
 *
 * Deterministic candidate detection: two rows in the SAME account with the
 * same normalized merchant, the same magnitude, and dates within 3 days are
 * flagged as a possible duplicate of each other. Detection only SUGGESTS; the
 * user decides (mark as duplicate / keep). Nothing is ever removed or excluded
 * without an explicit action.
 */
import type { Transaction } from "~/lib/finance/types";
import { daysBetween } from "~/lib/client/dates";
import { formatDollars } from "~/lib/money";

export interface DuplicateFlag {
  /** The transaction that might be the duplicate (usually the later one). */
  txnId: string;
  /** The transaction it may duplicate. */
  ofTxnId: string;
  reason: string;
}

function normalizedMerchant(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\.+$/, "")
    .trim();
}

/**
 * Find possible duplicates among a set of transactions. Skips rows the user
 * already resolved (marked duplicate or explicitly kept). One flag per pair;
 * deterministic order by (date, id).
 */
export function findDuplicateFlags(
  transactions: readonly Transaction[],
): DuplicateFlag[] {
  const flags: DuplicateFlag[] = [];
  const usable = transactions
    .filter((t) => !t.duplicateOf && !t.duplicateIgnored)
    .slice()
    .sort((a, b) => a.transactedAt.localeCompare(b.transactedAt) || a.id.localeCompare(b.id));

  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const a = usable[i];
      const b = usable[j];
      if (a.accountId !== b.accountId) continue;
      if (Math.abs(a.amountCents) !== Math.abs(b.amountCents)) continue;
      if (normalizedMerchant(a.merchant) !== normalizedMerchant(b.merchant)) continue;
      const gap = Math.abs(daysBetween(a.transactedAt, b.transactedAt));
      if (gap > 3) continue;
      // The later one is the likely duplicate; a pair yields one flag.
      const later = a.transactedAt >= b.transactedAt ? a : b;
      const earlier = later.id === a.id ? b : a;
      flags.push({
        txnId: later.id,
        ofTxnId: earlier.id,
        reason: `${later.merchant} · ${formatDollars(Math.abs(later.amountCents))} matches ${earlier.merchant} within ${gap === 0 ? "the same day" : `${gap} days`}.`,
      });
    }
  }
  return flags;
}

/** Map txnId → flag, for the transaction detail sheet. */
export function duplicateFlagFor(
  txnId: string,
  flags: readonly DuplicateFlag[],
): DuplicateFlag | null {
  return flags.find((f) => f.txnId === txnId) ?? null;
}