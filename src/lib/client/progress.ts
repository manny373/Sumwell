/**
 * Progress screen view builders — Phase 3b.
 *
 * Confirmed changes are derived ONLY from dated, sourced records (transactions
 * and confirmed goal contributions) — never from the plan and never from the
 * app itself. Projected line items stay in a separate channel with an "if you
 * follow this plan" label. Nothing here credits Sumwell with progress.
 */
import { goalProgress } from "~/lib/finance/goals";
import type { GoalContribution } from "~/lib/finance/types";
import { householdGoalContributions } from "./household";
import { lastReceivedPaycheck } from "./plan";
import { projectedGoalContributions } from "./planScreen";
import type { Household } from "./types";

export type ConfirmedChangeKind =
  | "debtPrincipalPaid"
  | "debtBalanceReduced"
  | "savingsContribution";

/** One dated, evidenced change. `amountCents` is the positive magnitude. */
export interface ConfirmedChange {
  id: string;
  date: string; // ISO
  kind: ConfirmedChangeKind;
  title: string;
  amountCents: number;
  /** Where the evidence lives (a dated transaction or entry). */
  detail: string;
  evidenceId: string;
}

const CREDIT_ACCOUNT_TYPES = new Set([
  "creditCard",
  "loan",
  "studentLoan",
  "autoLoan",
  "mortgage",
]);

/** Debt principals paid and balances reduced — straight from transactions. */
export function confirmedDebtChanges(household: Household): ConfirmedChange[] {
  const byId = new Map(household.accounts.map((a) => [a.id, a]));
  const changes: ConfirmedChange[] = [];
  for (const txn of household.transactions) {
    if (txn.status === "pending") continue; // not confirmed until posted
    if (txn.kind === "loanPayment" && txn.principalCents !== null) {
      changes.push({
        id: `debt-${txn.id}`,
        date: txn.transactedAt,
        kind: "debtPrincipalPaid",
        title: "Debt principal paid",
        amountCents: txn.principalCents,
        detail: `${txn.merchant} — payment on record (principal portion; interest is separate).`,
        evidenceId: txn.id,
      });
      continue;
    }
    const account = byId.get(txn.accountId);
    if (
      txn.kind === "transfer" &&
      txn.amountCents > 0 &&
      account &&
      CREDIT_ACCOUNT_TYPES.has(account.type)
    ) {
      changes.push({
        id: `credit-${txn.id}`,
        date: txn.transactedAt,
        kind: "debtBalanceReduced",
        title: `${account.name} balance reduced`,
        amountCents: txn.amountCents,
        detail: `${txn.merchant} — payment on record.`,
        evidenceId: txn.id,
      });
    }
  }
  return changes;
}

/** Confirmed goal deposits (dated, sourced; the note is the evidence). */
export function confirmedGoalChanges(household: Household): ConfirmedChange[] {
  const goalsById = new Map(household.goals.map((g) => [g.id, g]));
  return householdGoalContributions(household)
    .filter((c) => c.confirmed && c.source !== "projected")
    .map((c) => ({
      id: `goal-${c.id}`,
      date: c.date,
      kind: "savingsContribution" as const,
      title: `${goalsById.get(c.goalId)?.name ?? "Goal"} contribution`,
      amountCents: c.amountCents,
      detail:
        c.note ??
        `Deposit on record for ${c.date}.`,
      evidenceId: c.id,
    }));
}

/** Every confirmed change, newest first. */
export function allConfirmedChanges(household: Household): ConfirmedChange[] {
  return [...confirmedDebtChanges(household), ...confirmedGoalChanges(household)]
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? 1 : -1));
}

export interface CheckInSummary {
  /** Window anchor label, e.g. "since your last paycheck on Sep 10, 2026". */
  windowLabel: string;
  /** The confirmed changes that happened inside the window, newest first. */
  changes: ConfirmedChange[];
  /** Plain-language message for the card. */
  message: string;
}

/**
 * "What changed since your last check-in" — the check-in is modeled honestly
 * as the last received paycheck (real, dated money on record). When the data
 * doesn't support a window, the message is the honest "No confirmed changes
 * yet" empty state.
 */
export function checkInSummary(household: Household): CheckInSummary {
  const lastReceived = lastReceivedPaycheck(household);
  if (!lastReceived) {
    return {
      windowLabel: "since you started this household",
      changes: [],
      message:
        "No confirmed changes yet — nothing on record has moved since this household was set up.",
    };
  }
  const all = allConfirmedChanges(household);
  const inWindow = all.filter((c) => c.date > lastReceived.date);
  return {
    windowLabel: `since your last paycheck on ${lastReceived.date}`,
    changes: inWindow,
    message:
      inWindow.length === 0
        ? "No confirmed changes yet — nothing dated after your last paycheck has moved. Earlier changes are listed below."
        : "These confirmed changes happened after your last paycheck — each one has a dated record.",
  };
}

/* ------------------------------------------------------------- goals ----- */

export interface GoalProgressView {
  goal: ReturnType<typeof goalProgress>;
  /** The accepted per-cycle allocation behind the projected line. */
  acceptedCents: number;
  /** The projected line items, dated at the next paycheck. */
  projected: GoalContribution[];
}

/**
 * Per-goal progress with confirmed history and projected line items kept
 * strictly separate (goalProgress never merges them; projections carry an
 * "if you follow this plan" label in the UI).
 */
export function goalProgressViews(household: Household): GoalProgressView[] {
  const projected = projectedGoalContributions(household);
  const all: GoalContribution[] = [
    ...householdGoalContributions(household),
    ...projected,
  ];
  const goals = household.goals
    .slice()
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  return goals.map((goal) => ({
    goal: goalProgress(goal, all, false),
    acceptedCents:
      household.assumptions.goalContributions.find(
        (g) => g.goalId === goal.id,
      )?.amountCents ?? 0,
    projected: projected.filter((p) => p.goalId === goal.id),
  }));
}