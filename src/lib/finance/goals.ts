/**
 * Goal progress — Phase 2.
 *
 * Confirmed contributions (dated, sourced from reality: manual entry,
 * paycheck allocation) form a dated history with running totals. Projected
 * contributions are shown SEPARATELY and never merged into the running
 * totals — nothing is attributed to the app, and projections are never
 * presented as achieved progress.
 */
import type { Goal, GoalContribution } from "./types";

export interface ConfirmedPoint {
  date: string;
  contributionCents: number;
  runningTotalCents: number;
}

export interface ProjectedPoint {
  date: string;
  amountCents: number;
  label: string;
}

export interface GoalProgressResult {
  goal: Goal;
  /** Current saved amount — reported from goal.savedCents (the source of truth). */
  currentSavedCents: number;
  targetCents: number;
  /** max(target − current, 0). */
  remainingCents: number;
  /** current / target × 10000, capped at 10000. 0 when target is 0. */
  percentCompleteBps: number;
  /** Sum of confirmed contributions only. */
  confirmedTotalCents: number;
  /** Confirmed contributions, sorted by date, with running totals. */
  confirmedHistory: ConfirmedPoint[];
  /** Sum of projected line items (0 when confirmedOnly). */
  projectedTotalCents: number;
  /** Projected plan line items — always kept separate from confirmed history. */
  projected: ProjectedPoint[];
  note: string;
}

export function goalProgress(
  goal: Goal,
  contributions: readonly GoalContribution[],
  confirmedOnly: boolean,
): GoalProgressResult {
  const goalContribs = contributions.filter((c) => c.goalId === goal.id);

  const isConfirmed = (c: GoalContribution) => c.confirmed && c.source !== "projected";

  const byDate = (a: GoalContribution, b: GoalContribution) =>
    a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1;

  const confirmed = goalContribs.filter(isConfirmed).slice().sort(byDate);
  const projected = confirmedOnly
    ? []
    : goalContribs.filter((c) => !isConfirmed(c)).slice().sort(byDate);

  let running = 0;
  const confirmedHistory: ConfirmedPoint[] = confirmed.map((c) => {
    running += c.amountCents;
    return { date: c.date, contributionCents: c.amountCents, runningTotalCents: running };
  });

  const confirmedTotalCents = confirmed.reduce((s, c) => s + c.amountCents, 0);
  const projectedTotalCents = projected.reduce((s, c) => s + c.amountCents, 0);
  const remainingCents = Math.max(goal.targetCents - goal.savedCents, 0);
  const percentCompleteBps =
    goal.targetCents > 0
      ? Math.min(Math.round((goal.savedCents * 10000) / goal.targetCents), 10000)
      : 0;

  return {
    goal,
    currentSavedCents: goal.savedCents,
    targetCents: goal.targetCents,
    remainingCents,
    percentCompleteBps,
    confirmedTotalCents,
    confirmedHistory,
    projectedTotalCents,
    projected: projected.map((p) => ({
      date: p.date,
      amountCents: p.amountCents,
      label: "Projected — not saved yet. Kept separate from confirmed history.",
    })),
    note: "Confirmed history shows dated, sourced contributions only; the goal's current balance is reported separately from goal.savedCents.",
  };
}