/**
 * Transaction classification — Phase 2.
 *
 * The core rule this module enforces: a card purchase and the later card
 * payment are NOT two spending events. Transfers and loan payments are
 * commitments, not expenses; a loan payment's principal/interest split is
 * information, never a second count of the same payment.
 */
import type { Transaction } from "./types";

export interface ExpenseSummary {
  /** Spending events: expense-kind, non-excluded (pending included). */
  expenseCents: number;
  /** Transfers between accounts — never spending. */
  transferCents: number;
  /** Loan/debt payments — one spending event per payment, counted once. */
  loanPaymentCents: number;
  /** Money-in events (paychecks, refunds…), non-excluded. */
  incomeCents: number;
  /** expenseCents + loanPaymentCents — actual cash-out events. */
  spendEventCents: number;
  /** Non-excluded pending transactions (informational). */
  pendingCents: number;
  /** Excluded transactions (magnitude) — kept out of every other bucket. */
  excludedCents: number;
}

export function summarizeExpenses(txns: readonly Transaction[]): ExpenseSummary {
  let expense = 0;
  let transfer = 0;
  let loan = 0;
  let income = 0;
  let pending = 0;
  let excluded = 0;

  for (const t of txns) {
    const magnitude = Math.abs(t.amountCents);
    if (t.isExcluded) {
      excluded += magnitude;
      continue;
    }
    if (t.status === "pending") pending += magnitude;
    switch (t.kind) {
      case "expense":
        expense += magnitude;
        break;
      case "transfer":
        transfer += magnitude;
        break;
      case "loanPayment":
        loan += magnitude;
        break;
      case "income":
        income += magnitude;
        break;
    }
  }

  return {
    expenseCents: expense,
    transferCents: transfer,
    loanPaymentCents: loan,
    incomeCents: income,
    spendEventCents: expense + loan,
    pendingCents: pending,
    excludedCents: excluded,
  };
}