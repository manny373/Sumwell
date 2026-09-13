import { describe, expect, test } from "bun:test";
import type { Transaction } from "~/lib/finance/types";
import { duplicateFlagFor, findDuplicateFlags } from "./duplicates";

function txn(over: Partial<Transaction> & { id: string }): Transaction {
  return {
    accountId: "acc-checking",
    merchant: "Merchant",
    amountCents: -1000,
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
    ...over,
  };
}

describe("findDuplicateFlags", () => {
  test("flags the later of two same-account rows with matching merchant, magnitude, ≤3 days", () => {
    const flags = findDuplicateFlags([
      txn({ id: "t1", merchant: "Starbucks", amountCents: -450, transactedAt: "2026-09-10" }),
      txn({ id: "t2", merchant: "Starbucks", amountCents: -450, transactedAt: "2026-09-12" }),
    ]);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ txnId: "t2", ofTxnId: "t1" });
    expect(flags[0].reason).toContain("Starbucks");
  });

  test("does not flag different merchants, amounts, accounts, or gaps > 3 days", () => {
    const base = txn({ id: "t1", merchant: "Starbucks", amountCents: -450, transactedAt: "2026-09-10" });
    const pair = (over: Partial<Transaction>) =>
      findDuplicateFlags([
        base,
        txn({ id: "t2", merchant: "Starbucks", amountCents: -450, transactedAt: "2026-09-12", ...over }),
      ]);

    expect(pair({ merchant: "Whole Foods" })).toEqual([]);
    expect(pair({ amountCents: -999 })).toEqual([]);
    expect(pair({ accountId: "acc-other" })).toEqual([]);
    // 5 days apart
    expect(
      findDuplicateFlags([
        base,
        txn({ id: "t2", merchant: "Starbucks", amountCents: -450, transactedAt: "2026-09-15" }),
      ]),
    ).toEqual([]);
  });

  test("same-magnitude opposite signs still match (magnitude is the contract)", () => {
    const flags = findDuplicateFlags([
      txn({ id: "t1", merchant: "Refund Co", amountCents: -1200, transactedAt: "2026-09-10" }),
      txn({ id: "t2", merchant: "Refund Co", amountCents: 1200, transactedAt: "2026-09-11" }),
    ]);
    expect(flags).toHaveLength(1);
    expect(flags[0].txnId).toBe("t2");
  });

  test("normalizes merchant case/whitespace/trailing dots", () => {
    const flags = findDuplicateFlags([
      txn({ id: "t1", merchant: "Corner Store", amountCents: -1200, transactedAt: "2026-09-10" }),
      txn({ id: "t2", merchant: "  corner store", amountCents: -1200, transactedAt: "2026-09-11" }),
      txn({ id: "t3", merchant: "Corner Store.", amountCents: -1200, transactedAt: "2026-09-12" }),
    ]);
    // t2 matches t1 through case/space normalization; t3 matches via trailing-dot strip.
    expect(flags.map((f) => `${f.txnId}->${f.ofTxnId}`)).toEqual([
      "t2->t1",
      "t3->t1",
      "t3->t2",
    ]);
  });

  test("skips rows the user already resolved (marked or ignored)", () => {
    const flags = findDuplicateFlags([
      txn({ id: "t1", merchant: "Starbucks", amountCents: -450, transactedAt: "2026-09-10" }),
      txn({
        id: "t2",
        merchant: "Starbucks",
        amountCents: -450,
        transactedAt: "2026-09-12",
        duplicateOf: "t1",
        isExcluded: true,
      }),
      txn({
        id: "t3",
        merchant: "Starbucks",
        amountCents: -450,
        transactedAt: "2026-09-13",
        duplicateIgnored: true,
      }),
    ]);
    expect(flags).toEqual([]);
  });

  test("three-of-a-kind yields deterministic pairwise flags", () => {
    const flags = findDuplicateFlags([
      txn({ id: "t1", merchant: "Gym", amountCents: -3000, transactedAt: "2026-09-10" }),
      txn({ id: "t2", merchant: "Gym", amountCents: -3000, transactedAt: "2026-09-11" }),
      txn({ id: "t3", merchant: "Gym", amountCents: -3000, transactedAt: "2026-09-12" }),
    ]);
    expect(flags.map((f) => `${f.txnId}->${f.ofTxnId}`)).toEqual([
      "t2->t1",
      "t3->t1",
      "t3->t2",
    ]);
  });
});

describe("duplicateFlagFor", () => {
  test("looks up the flag for a transaction id", () => {
    const flags = findDuplicateFlags([
      txn({ id: "t1", merchant: "Starbucks", amountCents: -450, transactedAt: "2026-09-10" }),
      txn({ id: "t2", merchant: "Starbucks", amountCents: -450, transactedAt: "2026-09-12" }),
    ]);
    expect(duplicateFlagFor("t2", flags)?.ofTxnId).toBe("t1");
    expect(duplicateFlagFor("missing", flags)).toBeNull();
  });
});