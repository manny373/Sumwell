import { describe, expect, test } from "bun:test";
import type { Transaction } from "~/lib/finance/types";
import { demoHousehold } from "~/lib/client/household";
import {
  PROTOTYPE_EXPORT_LABEL,
  TRANSACTIONS_CSV_HEADER,
  buildPrototypeExport,
  transactionsToCSV,
} from "./export";

describe("buildPrototypeExport", () => {
  test("labels the file honestly as prototype data, not a statement", () => {
    const h = demoHousehold("2026-09-12T00:00:00Z");
    const exp = buildPrototypeExport(h, "2026-09-12T10:00:00Z");
    expect(exp.app).toBe("Sumwell prototype");
    expect(exp.formatVersion).toBe(1);
    expect(exp.label).toBe(PROTOTYPE_EXPORT_LABEL);
    expect(exp.label).toBe("Sumwell prototype data — not a bank statement");
    expect(exp.exportedAt).toBe("2026-09-12T10:00:00Z");
    expect(exp.note).toContain("not a bank statement");
    expect(exp.household).toBe(h); // full state, unchanged
  });
});

describe("transactionsToCSV", () => {
  const txns: Transaction[] = [
    {
      id: "tx-1",
      accountId: "acc-1",
      merchant: 'Acme, Inc. "HQ"',
      amountCents: -4217,
      kind: "expense",
      status: "posted",
      category: "other",
      transactedAt: "2026-09-10",
      postedAt: "2026-09-10",
      splits: [],
      isExcluded: false,
      principalCents: null,
      interestCents: null,
      source: "manual",
    },
    {
      id: "tx-2",
      accountId: "acc-2",
      merchant: "Auto Loan Payment",
      amountCents: -100000,
      kind: "loanPayment",
      status: "posted",
      category: "loan payment",
      transactedAt: "2026-09-11",
      postedAt: "2026-09-11",
      splits: [],
      isExcluded: true,
      principalCents: 80000,
      interestCents: 20000,
      duplicateOf: "tx-1",
      source: "imported",
    },
  ];

  test("emits the fixed header row first", () => {
    const csv = transactionsToCSV([], () => undefined);
    const lines = csv.trimEnd().split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(TRANSACTIONS_CSV_HEADER.join(","));
  });

  test("serializes signed dollars, principal/interest, flags, and unknown accounts", () => {
    const csv = transactionsToCSV(txns, (id) => (id === "acc-1" ? "Checking" : undefined));
    const lines = csv.trimEnd().split("\n");
    expect(lines).toHaveLength(3);
    // Merchant with commas+quotes gets quoted and escaped; empty cells stay empty.
    expect(lines[1]).toBe(
      '2026-09-10,posted,acc-1,Checking,"Acme, Inc. ""HQ""",other,expense,-42.17,,,manual,no,',
    );
    // Loan payment splits principal/interest; excluded + duplicateOf serialize.
    // "-1,000.00" is quoted because the thousands separator is a CSV comma.
    expect(lines[2]).toBe(
      '2026-09-11,posted,acc-2,Unknown,Auto Loan Payment,loan payment,loanPayment,"-1,000.00",800.00,200.00,imported,yes,tx-1',
    );
  });

  test("trailing newline separates the last row", () => {
    const csv = transactionsToCSV([txns[0]], () => undefined);
    expect(csv.endsWith("\n")).toBe(true);
    expect(csv.trimEnd().split("\n")).toHaveLength(2);
  });
});