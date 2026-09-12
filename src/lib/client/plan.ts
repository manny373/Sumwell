/**
 * Home plan builder — Phase 3a.
 *
 * Turns a Household into the single Home-screen money story:
 *   - which paycheck is "next" (the first unreceived one),
 *   - which obligations fall inside this paycheck's window,
 *   - the engine's planForPaycheck result (integer cents, exactly-once
 *     deduction, negative shortfalls kept exact),
 *   - the next obligation due (earliest due ≥ today),
 *   - honesty states: stale (the modeled payday has passed), no-balance.
 *
 * Stale rule: the plan is only reassuring while its horizon is still ahead.
 * Once the next paycheck's date has passed, the modeled data is older than a
 * pay cycle → stale. When stale, callers must NOT show remaining-money
 * estimates (the spec forbids reassuring estimates from stale inputs).
 */
import { planForPaycheck, type PlanResult } from "~/lib/finance/plan";
import type { GivingPlan, Obligation, Paycheck } from "~/lib/finance/types";
import {
  addDays,
  daysBetween,
  nextMonthlyOccurrence,
} from "./dates";
import type { Household } from "./types";

export type HomePlanReason = "ok" | "stale" | "no-paycheck" | "no-balance";

export interface HomePlan {
  paycheck: Paycheck;
  /** Whole days from "now" until the paycheck arrives (0 = today). */
  daysUntilPaycheck: number;
  /** Eligible available funds; null = unknown (never invent a balance). */
  availableCents: number | null;
  /** The obligations this plan actually covers. */
  obligations: Obligation[];
  /** Earliest obligation with a due date ≥ today, or null. */
  nextObligation: { obligation: Obligation; dueDate: string } | null;
  /** Giving accepted for this period (null = skipped). */
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
 * Giving accepted for THIS period, in cents, from the giving plan:
 *   - disabled plan → null (skipped)
 *   - fixed, perPaycheck → the amount as entered
 *   - fixed, monthly → the per-check share (biweekly pay: amount ÷ 2;
 *     demo: $120/mo → $60/check — exact integer)
 *   - percent (of net, per check) → bpsOfCents(net, percentBps), integer
 * The user always chooses the amount/percent — the product never preselects.
 */
export function givingForCycle(
  givingPlan: GivingPlan | null,
  netCents: number,
): number | null {
  if (!givingPlan || !givingPlan.enabled) return null;
  if (givingPlan.mode === "fixed" && givingPlan.amountCents !== null) {
    if (givingPlan.schedule === "perPaycheck") return givingPlan.amountCents;
    if (givingPlan.schedule === "monthly") {
      // Biweekly pay => two checks per month. Exact for the demo ($120/mo).
      return Math.round(givingPlan.amountCents / 2);
    }
    return null; // annual — not modeled in Phase 3a
  }
  if (givingPlan.mode === "percent" && givingPlan.percentBps !== null) {
    return Math.round((netCents * givingPlan.percentBps) / 10000);
  }
  return null;
}

/**
 * Build the Home plan for a household as of `nowISO`.
 *
 * Hand-checked demo example (now = 2026-09-12):
 *   available 179,994 − obligations 35,870 (6 bills between Sep 10 and Sep 25)
 *   − essentials 25,000 − emergency fund 20,000 − giving 6,000 − buffer 30,000
 *   = remaining 63,124 ($631.24). Healthy.
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

  const givingCents = givingForCycle(household.givingPlan, paycheck.netCents);
  const plan = planForPaycheck(
    paycheck,
    obligations,
    household.assumptions.essentialsPerCycleCents,
    household.assumptions.goalContributions,
    givingCents,
    household.assumptions.bufferCents,
    availableCents,
  );

  const nextObligation = nextObligationDueOnOrAfter(household.obligations, nowISO);

  return {
    reason: "ok",
    plan: {
      paycheck,
      daysUntilPaycheck: Math.max(0, daysBetween(nowISO, paycheck.date)),
      availableCents,
      obligations,
      nextObligation,
      givingCents,
      incomeUncertain: !paycheck.received,
      plan,
    },
  };
}

/** Earliest obligation due ≥ now (uses "today" boundary, not the window). */
export function nextObligationDueOnOrAfter(
  obligations: readonly Obligation[],
  nowISO: string,
): { obligation: Obligation; dueDate: string } | null {
  const beforeToday = addDays(nowISO, -1);
  const candidates: Array<{ obligation: Obligation; dueDate: string }> = [];
  for (const obligation of obligations) {
    const dueDate = nextObligationDate(obligation, beforeToday);
    if (dueDate !== null) {
      candidates.push({ obligation, dueDate });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) =>
    a.dueDate === b.dueDate
      ? a.obligation.name.localeCompare(b.obligation.name)
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