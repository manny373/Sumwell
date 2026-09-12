import { describe, expect, test } from "bun:test";
import type { Transaction } from "./types";
import { summarizeExpenses } from "./transactions";
import { createDemoSnapshot } from "./seed";

const txn = (over: Partial<Transaction>): Transaction => ({
  id: "t",
  accountId: "acc",
  merchant: "Merchant",
  amountCents: -100,
  kind: "expense",
  status: "posted",
  category: "other",
  transactedAt: "2026-09-01",
  postedAt: "2026-09-01",
  splits: [],
  isExcluded: false,
  principalCents: null,
  interestCents: null,
  source: "demo",
  ...over,
});

describe("summarizeExpenses — no double-counted spending events", () => {
  test("a card purchase and the later card payment are NOT two spending events", () => {
    const txns = [
      // Purchase on the card: real spend.
      txn({ id: "purchase", merchant: "Corner Grocery", amountCents: -8422, kind: "expense" }),
      // Payment from checking to the card: a transfer, excluded from spending.
      txn({ id: "pay-out", merchant: "Payment to card", amountCents: -50000, kind: "transfer" }),
      // Mirror credit on the card: same transfer, also not spending.
      txn({ id: "pay-in", merchant: "Payment from checking", amountCents: 50000, kind: "transfer" }),
    ];
    const s = summarizeExpenses(txns);
    expect(s.expenseCents).toBe(8422); // counted ONCE
    expect(s.transferCents).toBe(100000); // both legs of the transfer
    expect(s.spendEventCents).toBe(8422);
  });

  test("loan payment is one spending event; principal/interest split never doubles it", () => {
    const txns = [
      txn({
        id: "loan-pay",
        merchant: "Auto Loan Payment",
        amountCents: -31240,
        kind: "loanPayment",
        principalCents: 24506,
        interestCents: 6734,
      }),
      txn({ id: "grocery", merchant: "Groceries", amountCents: -4217, kind: "expense", status: "pending", postedAt: null }),
      txn({ id: "paycheck", merchant: "Employer", amountCents: 215384, kind: "income" }),
      txn({ id: "excluded", merchant: "Hidden", amountCents: -1200, kind: "expense", isExcluded: true }),
    ];
    const s = summarizeExpenses(txns);
    expect(s.loanPaymentCents).toBe(31240); // once, not 24506 + 6734 + 31240
    expect(s.expenseCents).toBe(4217);
    expect(s.spendEventCents).toBe(31240 + 4217);
    expect(s.incomeCents).toBe(215384);
    expect(s.excludedCents).toBe(1200);
    expect(s.pendingCents).toBe(4217);
  });

  test("seed household: card purchase appears once across checking + card accounts", () => {
    const seed = createDemoSnapshot();
    const s = summarizeExpenses(seed.transactions);
    // Hand-totaled from the seed: checking expenses (incl. pending grocery)
    // 165000+9840+6999+11250+11833+1599+1099+4500+4217 = 216337, card 8422+4620+6733 = 19775.
    expect(s.expenseCents).toBe(216337 + 19775);
    expect(s.transferCents).toBe(50000 + 20000 + 20000 + 50000);
    expect(s.loanPaymentCents).toBe(31240);
    expect(s.incomeCents).toBe(430768);
    expect(s.pendingCents).toBe(4217);
  });
});