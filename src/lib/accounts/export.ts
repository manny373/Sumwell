/**
 * Export — Phase 3c.
 *
 * Two honest, deterministic exports:
 *  1. Full prototype state as JSON, explicitly labeled "prototype data — not a
 *     bank statement".
 *  2. Transactions as CSV (date, status, account, description, category, kind,
 *     signed amount in integer-cents-to-dollars, principal/interest, source).
 * Nothing here claims to be a statement, a receipt, or official anything.
 */
import { formatDollars } from "~/lib/money";
import type { Transaction } from "~/lib/finance/types";
import type { Household } from "~/lib/client/types";

export const PROTOTYPE_EXPORT_LABEL =
  "Sumwell prototype data — not a bank statement";

export interface PrototypeExport {
  app: "Sumwell prototype";
  formatVersion: 1;
  label: typeof PROTOTYPE_EXPORT_LABEL;
  exportedAt: string;
  note: string;
  household: Household;
}

/** Whole app state for backup/porting — everything the app knows. */
export function buildPrototypeExport(
  household: Household,
  nowISO: string,
): PrototypeExport {
  return {
    app: "Sumwell prototype",
    formatVersion: 1,
    label: PROTOTYPE_EXPORT_LABEL,
    exportedAt: nowISO,
    note: "This file is a prototype export of the data stored on this device. It is not a bank statement, a receipt, or any official financial document.",
    household,
  };
}

/* ------------------------------------------------------------ CSV ------- */

export const TRANSACTIONS_CSV_HEADER = [
  "date",
  "status",
  "accountId",
  "accountName",
  "description",
  "category",
  "kind",
  "amount",
  "principal",
  "interest",
  "source",
  "excluded",
  "duplicateOf",
];

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Signed dollars with 2 decimals via integer math ("-42.17"). */
function centsToDollars(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}${formatDollars(Math.abs(cents))}`;
}

/**
 * Transactions as CSV text. Rows are not pre-sorted here — callers pass the
 * order they want; this module only serializes.
 */
export function transactionsToCSV(
  transactions: readonly Transaction[],
  accountName: (id: string) => string | undefined,
): string {
  const lines = [TRANSACTIONS_CSV_HEADER.map(csvCell).join(",")];
  for (const t of transactions) {
    lines.push(
      [
        t.transactedAt,
        t.status,
        t.accountId,
        accountName(t.accountId) ?? "Unknown",
        t.merchant,
        t.category,
        t.kind,
        centsToDollars(t.amountCents),
        t.principalCents === null ? "" : centsToDollars(t.principalCents),
        t.interestCents === null ? "" : centsToDollars(t.interestCents),
        t.source,
        t.isExcluded ? "yes" : "no",
        t.duplicateOf ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}