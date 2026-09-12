/**
 * Debt payoff comparison — Phase 2.
 *
 * Avalanche (highest APR first) vs snowball (smallest balance first) with an
 * EXPLICIT extra-payment budget, preserving every minimum payment. All math is
 * integer cents, monthly. Payoff dates and interest are ESTIMATES — the
 * projection assumes today's balances, rates, and minimums stay constant.
 *
 * Honesty rules baked in:
 * - Unknown APR => interest is never invented; that debt's interest is null
 *   and its payoff date is flagged as assuming no additional interest.
 * - Variable/promotional rates are flagged, never silently treated as fixed.
 * - No auto-refinance, no forgiveness, no fees invented.
 * - Output is rounded sensibly (dates to days, interest to cents) — no false
 *   precision.
 */
import type { Debt } from "./types";

export interface DebtPayoffRow {
  debtId: string;
  name: string;
  category: string;
  aprBps: number | null;
  aprKind: string;
  /** Months from the start until paid off; null when not paid within the horizon. */
  payoffMonth: number | null;
  /** ISO date estimate; null when not paid within the horizon. */
  payoffDate: string | null;
  /** Interest paid toward this debt. null when APR unknown — never invented. */
  interestCents: number | null;
  /** Total paid when paid off (starting balance + interest); outstanding balance otherwise. */
  totalPaidCents: number;
  paidOff: boolean;
  /** true when interest could not be computed (APR unknown). */
  interestIgnored: boolean;
  /** Payoff dates are always estimates — this is structural, not an omission. */
  payoffDateIsEstimate: true;
}

export interface DebtStrategyResult {
  strategy: "avalanche" | "snowball";
  payoffRows: DebtPayoffRow[];
  /** Sum of interest across rows; null when any APR is unknown (incomplete). */
  totalInterestCents: number | null;
  /** Sum of computed interest only — always safe to show with an "estimate" label. */
  totalInterestKnownCents: number;
  /** false when any debt had an unknown APR. */
  interestComplete: boolean;
  totalPaidCents: number;
  lastPayoffDate: string | null;
  lastPayoffMonth: number | null;
  /** true when the 600-month horizon was hit and payoffs may be incomplete. */
  truncated: boolean;
  estimateNotes: string[];
}

/** Horizon cap so a pathological input can never loop forever. */
export const MAX_PAYOFF_MONTHS = 600;

interface SimDebt {
  debt: Debt;
  balance: number;
  interestTotal: number;
  payoffMonth: number | null;
}

/** Monthly interest in integer cents: balance * aprBps / 120000, half-up. */
function monthlyInterestCents(balanceCents: number, aprBps: number): number {
  return Math.round((balanceCents * aprBps) / 120000);
}

/** ISO-date + months with end-of-month clamping (e.g. Jan 31 + 1 => Feb 28). */
export function addMonthsISO(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const targetIndex = m - 1 + months;
  const y2 = y + Math.floor(targetIndex / 12);
  const m2 = ((targetIndex % 12) + 12) % 12 + 1;
  const lastDay = new Date(Date.UTC(y2, m2, 0)).getUTCDate();
  const d2 = Math.min(d, lastDay);
  return `${y2}-${String(m2).padStart(2, "0")}-${String(d2).padStart(2, "0")}`;
}

function simulate(
  debtsIn: readonly Debt[],
  extraBudgetCents: number,
  startDate: string,
  strategy: "avalanche" | "snowball",
): DebtStrategyResult {
  const debts: SimDebt[] = debtsIn
    .filter((d) => d.balanceCents > 0)
    .map((d) => ({ debt: d, balance: d.balanceCents, interestTotal: 0, payoffMonth: null }));

  const monthlyPool =
    debts.reduce((s, d) => s + d.debt.minPaymentCents, 0) + extraBudgetCents;

  const orderFor = (strategyName: "avalanche" | "snowball") => {
    return (a: SimDebt, b: SimDebt): number => {
      if (strategyName === "avalanche") {
        const apra = a.debt.aprBps ?? -1; // unknown APR sorts last
        const aprb = b.debt.aprBps ?? -1;
        if (apra !== aprb) return aprb - apra;
      } else {
        if (a.balance !== b.balance) return a.balance - b.balance;
      }
      return a.debt.id < b.debt.id ? -1 : 1;
    };
  };

  let month = 0;
  while (month < MAX_PAYOFF_MONTHS) {
    month++;
    // 1. Accrue interest on every open debt.
    for (const d of debts) {
      if (d.payoffMonth !== null) continue;
      if (d.debt.aprBps !== null) {
        const interest = monthlyInterestCents(d.balance, d.debt.aprBps);
        d.balance += interest;
        d.interestTotal += interest;
      }
    }
    // 2. Pay every minimum first (input order), capped at what is owed.
    let remaining = monthlyPool;
    for (const d of debts) {
      if (d.payoffMonth !== null) continue;
      const pay = Math.min(d.debt.minPaymentCents, d.balance);
      d.balance -= pay;
      remaining -= pay;
      if (d.balance === 0) d.payoffMonth = month;
    }
    // 3. Extra money cascades down the strategy order; overflows roll onward.
    const targets = debts.filter((d) => d.payoffMonth === null).sort(orderFor(strategy));
    for (const d of targets) {
      if (remaining <= 0) break;
      const pay = Math.min(remaining, d.balance);
      d.balance -= pay;
      remaining -= pay;
      if (d.balance === 0) d.payoffMonth = month;
    }
    if (debts.every((d) => d.payoffMonth !== null)) break;
  }

  const truncated = debts.some((d) => d.payoffMonth === null);
  const payoffRows: DebtPayoffRow[] = debts.map((d) => {
    const interestKnown = d.debt.aprBps !== null;
    return {
      debtId: d.debt.id,
      name: d.debt.name,
      category: d.debt.category,
      aprBps: d.debt.aprBps,
      aprKind: d.debt.aprKind,
      payoffMonth: d.payoffMonth,
      payoffDate: d.payoffMonth === null ? null : addMonthsISO(startDate, d.payoffMonth),
      interestCents: interestKnown ? d.interestTotal : null,
      totalPaidCents: d.debt.balanceCents + (interestKnown ? d.interestTotal : 0),
      paidOff: d.payoffMonth !== null,
      interestIgnored: !interestKnown,
      payoffDateIsEstimate: true,
    };
  });

  const totalInterestKnownCents = payoffRows.reduce(
    (s, r) => s + (r.interestCents ?? 0),
    0,
  );
  const interestComplete = payoffRows.every((r) => r.interestCents !== null);
  const totalPaidCents = payoffRows.reduce((s, r) => s + r.totalPaidCents, 0);
  const paidRows = payoffRows.filter((r) => r.payoffMonth !== null);
  const lastPayoffMonth =
    paidRows.length > 0 ? Math.max(...paidRows.map((r) => r.payoffMonth as number)) : null;

  const estimateNotes: string[] = [
    "Payoff dates and interest assume today's balances, rates, and minimum payments stay constant — estimates, not guarantees.",
  ];
  for (const d of debts) {
    if (d.debt.aprBps === null) {
      estimateNotes.push(
        `"${d.debt.name}" has an unknown APR; its payoff date assumes no additional interest accrues and is an estimate.`,
      );
    } else if (d.debt.aprKind === "variable") {
      estimateNotes.push(
        `"${d.debt.name}" has a variable rate; its projection uses today's rate as an estimate.`,
      );
    } else if (d.debt.aprKind === "promotional") {
      estimateNotes.push(
        `"${d.debt.name}" has a promotional rate${
          d.debt.promoTerms ? ` (${d.debt.promoTerms})` : ""
        }; its projection assumes the promotional rate for the whole payoff period — an estimate.`,
      );
    }
  }

  return {
    strategy,
    payoffRows,
    totalInterestCents: interestComplete ? totalInterestKnownCents : null,
    totalInterestKnownCents,
    interestComplete,
    totalPaidCents,
    lastPayoffDate: lastPayoffMonth === null ? null : addMonthsISO(startDate, lastPayoffMonth),
    lastPayoffMonth,
    truncated,
    estimateNotes,
  };
}

export interface DebtComparison {
  avalanche: DebtStrategyResult;
  snowball: DebtStrategyResult;
}

/**
 * Compare avalanche vs snowball on the same debts with the same explicit
 * extra budget. Both strategies preserve every minimum payment.
 */
export function debtComparison(
  debts: readonly Debt[],
  extraBudgetCents: number,
  startDate = "2026-09-01",
): DebtComparison {
  return {
    avalanche: simulate(debts, extraBudgetCents, startDate, "avalanche"),
    snowball: simulate(debts, extraBudgetCents, startDate, "snowball"),
  };
}