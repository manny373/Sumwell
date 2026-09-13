import { describe, expect, test } from "bun:test";
import type { ImportDraft } from "~/lib/accounts/import";
import { demoHousehold } from "./household";
import {
  nextIdWithPrefix,
  withAccountConnectionStatus,
  withAddedAccount,
  withAddedTransaction,
  withDeletedAccount,
  withDuplicateIgnored,
  withImportedTransactions,
  withTransactionCategory,
  withTransactionDuplicate,
  withTransactionExcluded,
  withTransactionPosted,
  withTransactionTransfer,
} from "./household";

const demo = () => demoHousehold("2026-09-12T00:00:00Z");

describe("phase 3c household mutations (pure, no side effects)", () => {
  test("nextIdWithPrefix picks the max numeric suffix and increments", () => {
    expect(nextIdWithPrefix("imp-", ["imp-1", "imp-3", "tx-9"])).toBe("imp-4");
    expect(nextIdWithPrefix("imp-", [])).toBe("imp-1");
    expect(nextIdWithPrefix("manual-", ["tx-1", "manual-7"])).toBe("manual-8");
  });

  test("withAddedAccount appends a record without touching the rest", () => {
    const h = demo();
    const account = {
      ...h.accounts[0],
      id: "acc-new",
      name: "New Checking",
    };
    const next = withAddedAccount(h, account);
    expect(next.accounts).toHaveLength(h.accounts.length + 1);
    expect(next.accounts.at(-1)?.id).toBe("acc-new");
    expect(next.transactions).toEqual(h.transactions);
    expect(h.accounts).toHaveLength(h.accounts.length); // input unchanged
  });

  test("withDeletedAccount removes the account and its transactions, nulls links", () => {
    const h = {
      ...demo(),
      obligations: demo().obligations.map((o, i) =>
        i === 0 ? { ...o, accountId: "acc-401k" } : o,
      ),
      paychecks: demo().paychecks.map((p, i) =>
        i === 0 ? { ...p, accountId: "acc-401k" } : p,
      ),
    };
    const next = withDeletedAccount(h, "acc-401k");
    expect(next.accounts.find((a) => a.id === "acc-401k")).toBeUndefined();
    expect(next.transactions.some((t) => t.accountId === "acc-401k")).toBe(false);
    expect(next.obligations[0].accountId).toBeNull();
    expect(next.paychecks[0].accountId).toBeNull();
    // other obligations keep their links
    expect(next.obligations.slice(1).every((o) => o.accountId === "acc-checking")).toBe(true);
  });

  test("withAddedTransaction prepends one manual transaction", () => {
    const h = demo();
    const txn = { ...h.transactions[0], id: "manual-1" };
    const next = withAddedTransaction(h, txn);
    expect(next.transactions[0].id).toBe("manual-1");
    expect(next.transactions).toHaveLength(h.transactions.length + 1);
  });

  test("withImportedTransactions assigns imp-N ids, source imported, prepended", () => {
    const h = demo();
    const drafts: ImportDraft[] = [
      { dateISO: "2026-09-10", merchant: "Corner Store", amountCents: -1200, category: "groceries", kind: "expense", status: "posted" },
      { dateISO: "2026-09-11", merchant: "Side Gig", amountCents: 50000, category: "income", kind: "income", status: "posted" },
    ];
    const next = withImportedTransactions(h, drafts, "acc-checking");
    expect(next.transactions).toHaveLength(h.transactions.length + 2);
    expect(next.transactions[0]).toMatchObject({
      id: "imp-1",
      accountId: "acc-checking",
      merchant: "Corner Store",
      amountCents: -1200,
      category: "groceries",
      source: "imported", // never "connected"
    });
    expect(next.transactions[1].id).toBe("imp-2");
    expect(next.transactions[1].source).toBe("imported");
    // unknown account or empty drafts → unchanged reference
    expect(withImportedTransactions(h, drafts, "acc-nope")).toBe(h);
    expect(withImportedTransactions(h, [], "acc-checking")).toBe(h);
  });

  test("withTransactionCategory corrects only the target transaction", () => {
    const h = demo();
    const target = h.transactions.find((t) => t.id === "txn-payday-0826")!;
    const next = withTransactionCategory(h, target.id, "  dining  ");
    expect(next.transactions.find((t) => t.id === target.id)?.category).toBe("dining");
    expect(next.transactions.filter((t) => t.id !== target.id)).toEqual(
      h.transactions.filter((t) => t.id !== target.id),
    );
    expect(withTransactionCategory(h, target.id, "   ")).toBe(h); // blank → no-op
  });

  test("withTransactionExcluded toggles isExcluded for one row", () => {
    const h = demo();
    const id = h.transactions[0].id;
    expect(withTransactionExcluded(h, id, true).transactions[0].isExcluded).toBe(true);
    expect(withTransactionExcluded(h, id, false).transactions[0].isExcluded).toBe(false);
  });

  test("withTransactionDuplicate marks + auto-excludes, and clearing restores", () => {
    const h = demo();
    const [a, b] = [h.transactions[0], h.transactions[1]];
    const marked = withTransactionDuplicate(h, b.id, a.id);
    expect(marked.transactions.find((t) => t.id === b.id)).toMatchObject({
      duplicateOf: a.id,
      isExcluded: true,
    });
    const cleared = withTransactionDuplicate(marked, b.id, null);
    expect(cleared.transactions.find((t) => t.id === b.id)).toMatchObject({
      duplicateOf: null,
      isExcluded: false,
    });
  });

  test("withDuplicateIgnored records the keep choice and clears any mark", () => {
    const h = demo();
    const id = h.transactions[0].id;
    const kept = withDuplicateIgnored(h, id, true);
    expect(kept.transactions[0].duplicateIgnored).toBe(true);
    expect(kept.transactions[0].duplicateOf ?? null).toBeNull();
    const undo = withDuplicateIgnored(kept, id, false);
    expect(undo.transactions[0].duplicateIgnored).toBe(false);
  });

  test("withTransactionPosted reconciles pending → posted with postedAt", () => {
    const h = demo();
    const pending = { ...h.transactions[0], id: "pend-1", status: "pending" as const, postedAt: null };
    const withPending = { ...h, transactions: [pending, ...h.transactions] };
    const next = withTransactionPosted(withPending, "pend-1");
    expect(next.transactions[0].status).toBe("posted");
    expect(next.transactions[0].postedAt).toBe(next.transactions[0].transactedAt);
    // already-posted rows are untouched
    const posted = withTransactionPosted(withPending, h.transactions[0].id);
    expect(posted.transactions[1]).toEqual(withPending.transactions[1]);
  });

  test("withTransactionTransfer re-labels user expenses as transfers, never demo rows", () => {
    const h = demo();
    const manual = { ...h.transactions[0], id: "manual-x", source: "manual" as const, kind: "expense" as const, category: "uncategorized" };
    const withManual = { ...h, transactions: [manual, ...h.transactions] };
    const next = withTransactionTransfer(withManual, "manual-x");
    expect(next.transactions[0].kind).toBe("transfer");
    expect(next.transactions[0].category).toBe("transfers");
    // demo rows keep their labels (part of the demo)
    const demoId = h.transactions.find((t) => t.source === "demo" && t.kind === "expense")!.id;
    const next2 = withTransactionTransfer(h, demoId);
    expect(next2.transactions.find((t) => t.id === demoId)!.kind).toBe("expense");
  });

  test("withAccountConnectionStatus changes simulated states but never demo/manual", () => {
    const h = {
      ...demo(),
      accounts: demo().accounts.map((a) =>
        a.id === "acc-401k" ? { ...a, connectionStatus: "connected" as const } : a,
      ),
    };
    const stale = withAccountConnectionStatus(h, "acc-401k", "stale");
    expect(stale.accounts.find((a) => a.id === "acc-401k")?.connectionStatus).toBe("stale");
    // demo/manual records can never be relabeled to a simulated state
    const demoH = withAccountConnectionStatus(demo(), "acc-checking", "disconnected");
    expect(demoH.accounts.find((a) => a.id === "acc-checking")?.connectionStatus).toBe("demo");
  });
});