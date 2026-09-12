import { describe, expect, test } from "bun:test";
import type { Goal, GoalContribution } from "./types";
import { goalProgress } from "./goals";

const goal: Goal = {
  id: "goal-emergency",
  name: "Emergency fund",
  kind: "emergencyFund",
  targetCents: 1500000,
  savedCents: 845000,
  priority: 1,
  source: "demo",
};

const contrib = (over: Partial<GoalContribution>): GoalContribution => ({
  id: "c",
  goalId: "goal-emergency",
  amountCents: 50000,
  date: "2026-05-01",
  source: "manual",
  confirmed: true,
  ...over,
});

describe("goalProgress — confirmed history vs projected line items", () => {
  const contributions = [
    // Deliberately out of date order — history must come back sorted.
    contrib({ id: "c3", amountCents: 200000, date: "2026-07-01", source: "projected", confirmed: false }),
    contrib({ id: "c1", amountCents: 50000, date: "2026-05-01", source: "manual" }),
    contrib({ id: "c2", amountCents: 200000, date: "2026-06-01", source: "paycheckAllocation" }),
  ];

  test("confirmed contributions form the dated history; projections stay separate", () => {
    const result = goalProgress(goal, contributions, false);
    expect(result.confirmedHistory).toEqual([
      { date: "2026-05-01", contributionCents: 50000, runningTotalCents: 50000 },
      { date: "2026-06-01", contributionCents: 200000, runningTotalCents: 250000 },
    ]);
    // The projected $200,000 must NOT appear in the running totals.
    expect(result.confirmedTotalCents).toBe(250000);
    expect(result.projectedTotalCents).toBe(200000);
    expect(result.projected).toHaveLength(1);
    expect(result.projected[0].amountCents).toBe(200000);
    expect(result.projected[0].label).toContain("Projected");
  });

  test("current saved amount and completion come from the goal, not the projection", () => {
    const result = goalProgress(goal, contributions, false);
    expect(result.currentSavedCents).toBe(845000);
    expect(result.remainingCents).toBe(655000);
    expect(result.percentCompleteBps).toBe(5633); // 845000/1500000×10000 ≈ 5633.33
  });

  test("confirmedOnly hides projections but never merges them into history", () => {
    const result = goalProgress(goal, contributions, true);
    expect(result.projected).toEqual([]);
    expect(result.projectedTotalCents).toBe(0);
    expect(result.confirmedHistory).toHaveLength(2);
    expect(result.confirmedTotalCents).toBe(250000);
  });
});