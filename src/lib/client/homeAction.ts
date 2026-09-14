/**
 * Home "one next action" — Phase 4b (Finding 7).
 *
 * The next action is a REAL control the user can press: it targets the
 * relevant workflow (review a bill, review a debt payment, view an
 * allocation, or view the simulated rule previews) and NEVER implies
 * re-reserving money the plan already set aside.
 *
 * State language is exact:
 *   - planned      → the plan accounts for this item this cycle ("Already set
 *                    aside in your plan — nothing to re-reserve").
 *   - in balance   → an already-reflected obligation: the money already came
 *                    out of the available balance ("Already reflected in your
 *                    balance").
 *   - scheduled    → the due date is on record and displayed.
 *   - paid         → never claimed for an item without a dated payment; the
 *                    paid-on-record state is only shown where the audit proves
 *                    it (debt minimums covered by a posted payment).
 *
 * No invented amounts: every number comes from the HomePlan/engine result.
 */
import type { Household } from "./types";
import type { HomePlan, NextObligationItem } from "./plan";
import { formatCents } from "~/lib/money";
import { formatWeekdayMonthDay } from "./dates";

export type HomeActionKind =
  | "review-bill" // an obligation is next due
  | "review-payment" // a debt minimum is next due
  | "view-allocation" // goals have accepted allocations this cycle
  | "view-rule-preview" // automated (simulated) rule previews exist
  | "review-plan" // the plan is short — review and adjust
  | "view-plan"; // nothing due — keep the plan in view

export interface HomeAction {
  kind: HomeActionKind;
  /** Button label — the primary CTA text. */
  label: string;
  /** Plan-tab section this action opens (no hash = top of Plan). */
  hash: string | null;
  /** The headline sentence next to the CTA. */
  headline: string;
  /** Calm supporting detail (never an urgency trick). */
  detail: string | null;
  /** When the money is already accounted for, say so exactly. */
  setAsideNote: string | null;
  /** The exact next obligation driving this action, when there is one. */
  nextObligation: NextObligationItem | null;
}

const PLAN_HASHES = {
  bills: "#bills",
  debt: "#debt",
  goals: "#goals",
  automation: "#automation",
} as const;

/** Obligation-based action — "Review bill". */
function billAction(next: NextObligationItem): HomeAction {
  return {
    kind: "review-bill",
    label: "Review bill",
    hash: PLAN_HASHES.bills,
    headline: `${next.name} — ${formatCents(next.amountCents)} due ${formatWeekdayMonthDay(next.dueDate)}.`,
    detail: next.reflected
      ? "This bill already came out of your available balance, so the plan does not set it aside again."
      : "The plan sets this amount aside for the bill. Review it, adjust it, or move it to another pay cycle on the Plan tab.",
    setAsideNote: next.reflected
      ? "Already reflected in your balance"
      : "Already set aside in your plan",
    nextObligation: next,
  };
}

/** Debt-minimum action — "Review payment". */
function paymentAction(next: NextObligationItem): HomeAction {
  return {
    kind: "review-payment",
    label: "Review payment",
    hash: PLAN_HASHES.debt,
    headline: `Minimum payment for ${next.name.replace(/^Minimum — /, "")} — ${formatCents(next.amountCents)} due ${formatWeekdayMonthDay(next.dueDate)}.`,
    detail:
      "The plan sets this minimum aside exactly once. Nothing is re-reserved.",
    setAsideNote: "Already set aside in your plan",
    nextObligation: next,
  };
}

/**
 * Pick the ONE next action for the Home hero. Priority:
 *   1. Shortfall → review the plan (the calmest truthful action).
 *   2. The next obligation (bill or debt minimum) when one is due.
 *   3. Accepted goal allocations → "View allocation".
 *   4. Draft (simulated) automation rules → "View rule preview".
 *   5. Otherwise → "View plan".
 */
export function homePrimaryAction(
  household: Household,
  plan: HomePlan,
): HomeAction {
  const result = plan.plan;
  const next = plan.nextObligation;

  if (result.isShortfall) {
    return {
      kind: "review-plan",
      label: "Review the plan",
      hash: null,
      headline: `This plan is short ${formatCents(result.shortfallCents)} by ${formatWeekdayMonthDay(plan.paycheck.date)}.`,
      detail:
        "Trim this cycle's goals or giving, or move a non-essential bill to after payday. Nothing moves automatically — this is a plan, not a transfer.",
      setAsideNote: null,
      nextObligation: null,
    };
  }

  if (next) {
    return next.kind === "debtMinimum" ? paymentAction(next) : billAction(next);
  }

  const hasAcceptedGoals = household.assumptions.goalContributions.some(
    (g) => g.amountCents > 0,
  );
  if (hasAcceptedGoals) {
    return {
      kind: "view-allocation",
      label: "View allocation",
      hash: PLAN_HASHES.goals,
      headline: `Your goal allocations for this cycle — ${formatCents(
        household.assumptions.goalContributions.reduce(
          (s, g) => s + g.amountCents,
          0,
        ),
      )}.`,
      detail:
        "Ask yourself: does this still match your priorities? Allocations are virtual — they reserve nothing and move no money.",
      setAsideNote: "Already allocated in your plan",
      nextObligation: null,
    };
  }

  const hasDraftRules = household.automationRules.some(
    (r) => r.status === "draft",
  );
  if (hasDraftRules) {
    return {
      kind: "view-rule-preview",
      label: "View rule preview",
      hash: PLAN_HASHES.automation,
      headline: "Your simulated automation previews are ready to review.",
      detail:
        "Draft rules preview what WOULD move. Nothing executes in this prototype — a preview is never authorization.",
      setAsideNote: null,
      nextObligation: null,
    };
  }

  return {
    kind: "view-plan",
    label: "View plan",
    hash: null,
    headline: `Keep ${formatCents(result.remainingCents)} available this cycle.`,
    detail:
      "Nothing is due before your next paycheck — spend it, save it, or give it. Your buffer is already set aside.",
    setAsideNote: null,
    nextObligation: null,
  };
}