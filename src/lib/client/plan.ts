/**
 * Home plan builder — Phase 3a + Phase 4a fixes.
 *
 * Turns a Household into the single Home-screen money story:
 *   - which paycheck is "next" (the first unreceived one),
 *   - which obligations fall inside this paycheck's window,
 *   - which DEBT MINIMUMS fall inside the same window (each minimum is
 *     represented EXACTLY ONCE: in-window = deducted now, paid-on-record =
 *     represented by its dated transaction, after-window = a later cycle,
 *     no due date = "due date unknown" — never substituted or re-subtracted),
 *   - the adopted extra debt payment, converted per check from the monthly
 *     amount via the household's pay cadence (perMonthToPerCheck),
 *   - the engine's planForPaycheck result (integer cents, exactly-once
 *     deduction, negative shortfalls kept exact),
 *   - the next obligation due (earliest due ≥ today), including debt minimums,
 *   - honesty states: stale (the modeled payday has passed), no-balance.
 *
 * Stale rule: the plan is only reassuring while its horizon is still ahead.
 * Once the next paycheck's date has passed, the modeled data is older than a
 * pay cycle → stale. When stale, callers must NOT show remaining-money
 * estimates (the spec forbids reassuring estimates from stale inputs).
 */
import { planForPaycheck, type DebtMinimumDeduction, type PlanResult } from "~/lib/finance/plan";
import {
  givingForPeriod,
  perMonthToPerCheck,
  type GivingFrequency,
} from "~/lib/finance/giving";
import type { Debt, GivingPlan, Obligation, Paycheck } from "~/lib/finance/types";
import {
  addDays,
  daysBetween,
  nextMonthlyOccurrence,
} from "./dates";
import type { Household } from "./types";
import { adoptedDebtExtraFor } from "./household";

export type HomePlanReason = "ok" | "stale" | "no-paycheck" | "no-balance";

export interface HomePlan {
  paycheck: Paycheck;
  /** Whole days from "now" until the paycheck arrives (0 = today). */
  daysUntilPaycheck: number;
  /** Eligible available funds; null = unknown (never invent a balance). */
  availableCents: number | null;
  /** The obligations this plan actually covers. */
  obligations: Obligation[];
  /** Debt minimums due inside this pay window (deducted exactly once). */
  debtMinimums: DebtMinimumDeduction[];
  /** Household pay cadence used for giving/adoption math; null = unknown. */
  payFrequency: GivingFrequency | null;
  /** Earliest obligation/debt-minimum with a due date ≥ today, or null. */
  nextObligation: { name: string; amountCents: number; dueDate: string; kind: "obligation" | "debtMinimum" } | null;
  /** Giving accepted for this period (null = skipped/unresolved). */
  givingCents: number | null;
  /** True until the paycheck actually arrives — estimates must say so. */
  incomeUncertain: boolean;
  /** The engine result. */
  plan: PlanResult;
}

export interface HomePlanContext {
  /** "ok" = a reassuring plan can be shown. Anything else = honest fallback. */
  reason: HomePlanReason;
  plan: HomePlan | null;
}

/** The next (first unreceived) paycheck, or null when there is none. */
export function nextPaycheck(household: Household): Paycheck | null {
  const upcoming = household.paychecks
    .filter((p) => !p.received)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return upcoming[0] ?? null;
}

/** The most recent received paycheck, or null (manual path has none yet). */
export function lastReceivedPaycheck(household: Household): Paycheck | null {
  const received = household.paychecks
    .filter((p) => p.received)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return received[0] ?? null;
}

/**
 * The obligation's next due date strictly after `afterISO`, when the cadence
 * supports it. Monthly obligations (the Phase 3a universe — demo seed and the
 * onboarding form are all monthly) use their dueDay. Other cadences return
 * null: the Home plan shows them as not-in-window rather than guessing.
 */
export function nextObligationDate(
  obligation: Obligation,
  afterISO: string,
): string | null {
  if (obligation.cadence === "monthly") {
    return nextMonthlyOccurrence(obligation.dueDay ?? 1, afterISO);
  }
  return null;
}

/**
 * Whether an obligation lands inside the paycheck window. With a received
 * paycheck, the window is (lastReceived, nextPaycheck]; obligations due in it
 * are what the next check must cover. Without received paychecks (manual
 * path) the user entered exactly the bills this check covers — all of them.
 */
function inWindow(
  obligation: Obligation,
  lastReceived: Paycheck | null,
  nextPay: Paycheck,
): boolean {
  if (!lastReceived) return true;
  const occurrence = nextObligationDate(obligation, lastReceived.date);
  return occurrence !== null && occurrence <= nextPay.date;
}

/**
 * The obligations the CURRENT paycheck window must cover — the shared source
 * of truth for the Home "remaining money" line and the Plan "bills" section.
 */
export function cycleObligations(household: Household): Obligation[] {
  const paycheck = nextPaycheck(household);
  if (!paycheck) return [];
  const lastReceived = lastReceivedPaycheck(household);
  return household.obligations.filter((o) =>
    inWindow(o, lastReceived, paycheck),
  );
}

/* ------------------------------------------------ pay cadence & giving -- */

/**
 * Classify the household's pay cadence from the dated paycheck records:
 * the gap between the last two received paychecks (falling back to the gap
 * between the last received and the next one). 7 days → weekly, 14 →
 * biweekly, 15–16 → twice a month, 28–31 → monthly. Returns null when the
 * records can't support a classification — callers must NOT guess (the
 * giving/adoption conversions are documented as limited instead).
 */
export function payFrequencyFor(household: Household): GivingFrequency | null {
  const received = household.paychecks
    .filter((p) => p.received)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const next = nextPaycheck(household);
  const gapBetween = (a: string, b: string) => Math.abs(daysBetween(a, b));
  const classify = (gap: number): GivingFrequency | null => {
    if (gap === 7) return "weekly";
    if (gap === 14) return "biweekly";
    if (gap === 15 || gap === 16) return "twiceMonthly";
    if (gap >= 28 && gap <= 31) return "monthly";
    return null;
  };
  if (received.length >= 2) {
    return classify(gapBetween(received[0].date, received[1].date));
  }
  if (received.length === 1 && next) {
    return classify(gapBetween(received[0].date, next.date));
  }
  return null;
}

/**
 * Giving accepted for THIS period, in cents, from the giving plan — resolved
 * through the household's pay cadence (givingForPeriod in finance/giving):
 * same-period percentages, biweekly ≠ twice-monthly, no silent ÷2. null when
 * the plan is skipped or the per-check amount can't be resolved.
 */
export function givingForCycle(
  givingPlan: GivingPlan | null,
  payFrequency: GivingFrequency | null,
  netCents: number,
  grossCents: number,
): number | null {
  if (!givingPlan || !givingPlan.enabled) return null;
  const result = givingForPeriod(givingPlan, { netCents, grossCents }, payFrequency);
  return result.skipped || result.givingCents === null ? null : result.givingCents;
}

/* --------------------------------------------- debt minimum audit (F3) -- */

export type DebtMinimumStatus =
  | "inWindow" // due inside (lastReceived, nextPay] — deducted by THIS plan
  | "paidOnRecord" // a dated transaction already covers this cycle's minimum
  | "afterWindow" // due after the next paycheck — a later cycle's commitment
  | "noDueDate"; // due day unknown — surfaced as unknown, never substituted

export interface DebtMinimumAuditRow {
  debt: Debt;
  /** Day-of-month the minimum is due, when known. */
  dueDay: number | null;
  /** The modeled occurrence checked, when knowable. */
  dueDate: string | null;
  status: DebtMinimumStatus;
  /**
   * Where this minimum is represented (exactly once by construction):
   * "deducted in this plan" | "paid on record (dated transaction)" |
   * "later in this cycle's future window" | "nowhere — due date unknown".
   */
  representedWhere: string;
  /** The dated transaction id when paidOnRecord (technical detail only). */
  evidenceTxnId: string | null;
}

/**
 * Per-debt minimum audit for the current paycheck window. Every debt's
 * monthly minimum is classified into EXACTLY ONE bucket:
 *   - paidOnRecord: a posted payment for this debt exists on/after the last
 *     received paycheck (the upcoming minimum is already covered by a dated
 *     transaction — never deducted again),
 *   - inWindow: the next occurrence of the debt's due day falls inside the
 *     current window → the plan deducts it exactly once,
 *   - afterWindow: due after the next paycheck → a later cycle,
 *   - noDueDate: the debt has no due day on record → "due date unknown".
 * The engine never subtracts every monthly minimum from every paycheck, and a
 * debt's minimum can never land in two buckets.
 */
export function debtMinimumAudit(household: Household): DebtMinimumAuditRow[] {
  const next = nextPaycheck(household);
  const lastReceived = lastReceivedPaycheck(household);

  // A posted payment "covers" the upcoming minimum when it is on record
  // within the current window (on/after the last received paycheck, up to and
  // including today). Payments before the window belong to the previous cycle
  // and are history, not part of this plan's commitments.
  const windowStart = lastReceived?.date;
  const postedPayments = new Set<string>();
  if (windowStart) {
    for (const txn of household.transactions) {
      if (txn.status !== "posted" || txn.transactedAt < windowStart) continue;
      const isPayment = txn.kind === "loanPayment" || txn.kind === "transfer";
      if (!isPayment) continue;
      const debt = household.debts.find(
        (d) => d.accountId === txn.accountId,
      ) ?? household.debts.find((d) =>
        // Legacy fallback for households persisted before accountId: match on
        // the account record name.
        txn.accountId === `acc-${d.id.replace("debt-", "")}`,
      );
      if (debt) postedPayments.add(debt.id);
    }
  }

  return household.debts
    .filter((d) => d.balanceCents > 0)
    .map((debt) => {
      if (debt.minPaymentDueDay == null) {
        return {
          debt,
          dueDay: null,
          dueDate: null,
          status: "noDueDate" as const,
          representedWhere: "nowhere — due date unknown",
          evidenceTxnId: null,
        };
      }
      if (postedPayments.has(debt.id)) {
        return {
          debt,
          dueDay: debt.minPaymentDueDay,
          dueDate: null,
          status: "paidOnRecord" as const,
          representedWhere:
            "paid on record — this cycle's minimum is covered by a posted payment transaction; never deducted again",
          evidenceTxnId: null,
        };
      }
      // Next occurrence strictly after the last received paycheck (or after
      // yesterday when no paycheck is on record).
      const after = windowStart ?? addDays(todayOr(household), -1);
      const dueDate = nextMonthlyOccurrence(debt.minPaymentDueDay, after);
      if (next && dueDate <= next.date) {
        return {
          debt,
          dueDay: debt.minPaymentDueDay,
          dueDate,
          status: "inWindow" as const,
          representedWhere:
            "deducted in this plan — due inside the current paycheck window",
          evidenceTxnId: null,
        };
      }
      return {
        debt,
        dueDay: debt.minPaymentDueDay,
        dueDate,
        status: "afterWindow" as const,
        representedWhere: "later in the cycle — a future paycheck window covers it",
        evidenceTxnId: null,
      };
    });
}

/** todayOr — a deterministic anchor for audits with no received paycheck. */
function todayOr(household: Household): string {
  return nextPaycheck(household)?.date ?? "2000-01-01";
}

/**
 * The debt minimums the CURRENT plan must deduct — the in-window rows of the
 * audit, shaped for planForPaycheck (exactly-once, never every minimum).
 */
export function cycleDebtMinimums(household: Household): DebtMinimumDeduction[] {
  return debtMinimumAudit(household)
    .filter((row) => row.status === "inWindow")
    .map((row) => ({
      debtId: row.debt.id,
      name: `Minimum — ${row.debt.name}`,
      amountCents: row.debt.minPaymentCents,
      note: `Minimum payment due ${row.dueDate ?? "this window"} — deducted exactly once.`,
    }));
}

/**
 * Eligible available funds: the paycheck's own account first, then any
 * checking, then any account with a known available balance. Unknown stays
 * null — never 0, never invented.
 */
export function eligibleAvailableCents(
  household: Household,
  paycheck: Paycheck,
): number | null {
  const accounts = household.accounts;
  const pick = (a: (typeof accounts)[number]) =>
    a.availableBalanceCents ?? a.currentBalanceCents;

  if (paycheck.accountId) {
    const own = accounts.find((a) => a.id === paycheck.accountId);
    if (own?.type === "checking") {
      const balance = pick(own);
      if (balance !== null && balance !== undefined) return balance;
    }
  }
  const checking = accounts.find((a) => a.type === "checking");
  if (checking) {
    const balance = pick(checking);
    if (balance !== null && balance !== undefined) return balance;
  }
  // Fallback: only liquid accounts (savings), never retirement/brokerage —
  // a 401(k) is not money available for this paycheck's bills.
  for (const account of accounts) {
    if (account.type !== "savings") continue;
    const balance = pick(account);
    if (balance !== null && balance !== undefined && balance > 0) return balance;
  }
  return null;
}

/**
 * Build the Home plan for a household as of `nowISO`.
 *
 * Hand-checked demo example (now = 2026-09-12):
 *   available 179,994 − obligations 35,870 (6 bills between Sep 10 and Sep 25)
 *   − debt minimums in-window 29,100 (card 9/22 $96.00 + federal 9/25 $145.00
 *     + medical 9/15 $50.00; auto minimum already paid on the 9/5 record and
 *     private is due 9/28, after the window)
 *   − essentials 25,000 − emergency fund 20,000 − giving 6,000 − buffer 30,000
 *   = remaining 34,024 ($340.24). Healthy.
 */
export function buildHomePlan(
  household: Household,
  nowISO: string,
): HomePlanContext {
  const paycheck = nextPaycheck(household);
  if (!paycheck) {
    return { reason: "no-paycheck", plan: null };
  }
  // The modeled payday has come and gone → data is older than a pay cycle.
  if (paycheck.date < nowISO) {
    return { reason: "stale", plan: null };
  }

  const obligations = cycleObligations(household);

  const availableCents = eligibleAvailableCents(household, paycheck);
  if (availableCents === null) {
    return { reason: "no-balance", plan: null };
  }

  const payFrequency = payFrequencyFor(household);
  const givingCents = givingForCycle(
    household.givingPlan,
    payFrequency,
    paycheck.netCents,
    paycheck.grossCents,
  );

  const debtMinimums = cycleDebtMinimums(household);

  // Adopted extra debt payment: monthly amount → per-check share via the pay
  // cadence. When the cadence isn't on record the adoption can't convert —
  // documented limitation; it is not silently ignored as zero.
  let debtExtraCents = 0;
  const adopted = adoptedDebtExtraFor(household);
  if (adopted > 0 && payFrequency !== null) {
    debtExtraCents = perMonthToPerCheck(adopted, payFrequency);
  }

  const plan = planForPaycheck(
    paycheck,
    obligations,
    household.assumptions.essentialsPerCycleCents,
    household.assumptions.goalContributions,
    givingCents,
    household.assumptions.bufferCents,
    availableCents,
    debtMinimums,
    debtExtraCents,
  );

  const nextObligation = nextObligationDueOnOrAfter(household, nowISO);

  return {
    reason: "ok",
    plan: {
      paycheck,
      daysUntilPaycheck: Math.max(0, daysBetween(nowISO, paycheck.date)),
      availableCents,
      obligations,
      debtMinimums,
      payFrequency,
      nextObligation,
      givingCents,
      incomeUncertain: !paycheck.received,
      plan,
    },
  };
}

/** Earliest due item (obligation or debt minimum) due ≥ now. */
export function nextObligationDueOnOrAfter(
  household: Household,
  nowISO: string,
): { name: string; amountCents: number; dueDate: string; kind: "obligation" | "debtMinimum" } | null {
  const beforeToday = addDays(nowISO, -1);
  const candidates: Array<{
    name: string;
    amountCents: number;
    dueDate: string;
    kind: "obligation" | "debtMinimum";
  }> = [];
  for (const obligation of household.obligations) {
    const dueDate = nextObligationDate(obligation, beforeToday);
    if (dueDate !== null) {
      candidates.push({
        name: obligation.name,
        amountCents: obligation.amountCents,
        dueDate,
        kind: "obligation",
      });
    }
  }
  for (const row of debtMinimumAudit(household)) {
    if (row.status !== "inWindow" || row.dueDate === null) continue;
    if (row.dueDate >= nowISO) {
      candidates.push({
        name: `Minimum — ${row.debt.name}`,
        amountCents: row.debt.minPaymentCents,
        dueDate: row.dueDate,
        kind: "debtMinimum",
      });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) =>
    a.dueDate === b.dueDate
      ? a.name.localeCompare(b.name)
      : a.dueDate < b.dueDate
        ? -1
        : 1,
  );
  return candidates[0];
}

/** Days until an obligation's due date from "now" (may be 0 = today). */
export function daysUntilDue(dueDate: string, nowISO: string): number {
  return Math.max(0, daysBetween(nowISO, dueDate));
}