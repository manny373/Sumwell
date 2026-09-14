import { describe, expect, test } from "bun:test";
import { createDemoSnapshot } from "~/lib/finance/seed";
import type { GivingPlan } from "~/lib/finance/types";
import { demoHousehold, manualHouseholdFor } from "./household";
import {
  debtExtraBudgetFor,
  householdGoalContributions,
  withAllRulesPaused,
  withDebtExtraBudget,
  withGivingPlan,
  withGoalPriority,
  withRuleStatus,
} from "./household";
import type { ManualOnboardingInputs } from "./types";

const demo = () => demoHousehold("2026-09-12T00:00:00Z");

describe("phase 3b household mutations (pure, no side effects)", () => {
  test("withGivingPlan replaces the plan and leaves the rest untouched", () => {
    const h = demo();
    const plan: GivingPlan = {
      ...h.givingPlan,
      mode: "percent",
      amountCents: null,
      percentBps: 2500,
      enabled: true,
    };
    const next = withGivingPlan(h, plan);
    expect(next.givingPlan.mode).toBe("percent");
    expect(next.givingPlan.percentBps).toBe(2500);
    expect(next.obligations).toEqual(h.obligations);
    expect(next.goals).toEqual(h.goals);
    expect(h.givingPlan.mode).toBe("fixed"); // input never mutated
  });

  test("withRuleStatus pauses one rule without touching the others", () => {
    const h = demo();
    const next = withRuleStatus(h, "rule-emergency", "paused");
    expect(next.automationRules.find((r) => r.id === "rule-emergency")!.status).toBe(
      "paused",
    );
    expect(next.automationRules.find((r) => r.id === "rule-cc-min")!.status).toBe(
      "draft",
    );
  });

  test("withAllRulesPaused pauses everything; false resumes only paused ones", () => {
    const h = demo();
    const paused = withAllRulesPaused(h, true);
    expect(paused.automationRules.every((r) => r.status === "paused")).toBe(true);
    const resumed = withAllRulesPaused(paused, false);
    expect(resumed.automationRules.every((r) => r.status === "draft")).toBe(true);
  });

  test("withGoalPriority renumbers cleanly for a 3-goal household", () => {
    const h = {
      ...demo(),
      goals: [
        { ...demo().goals[0], id: "a", name: "A", priority: 1 },
        { ...demo().goals[0], id: "b", name: "B", priority: 2 },
        { ...demo().goals[0], id: "c", name: "C", priority: 3 },
      ],
    };
    const next = withGoalPriority(h, "c", 1);
    expect(next.goals.map((g) => [g.id, g.priority])).toEqual([
      ["c", 1],
      ["a", 2],
      ["b", 3],
    ]);
    const back = withGoalPriority(next, "a", 3);
    expect(back.goals.map((g) => [g.id, g.priority])).toEqual([
      ["c", 1],
      ["b", 2],
      ["a", 3],
    ]);
  });

  test("withGoalPriority rejects out-of-range priorities and no-ops on identity", () => {
    const h = demo();
    expect(withGoalPriority(h, "goal-emergency", 99)).toBe(h);
    expect(withGoalPriority(h, "goal-emergency", 1)).toBe(h);
    expect(withGoalPriority(h, "missing", 2)).toBe(h);
  });

  test("withDebtExtraBudget stores cents and refuses junk", () => {
    const h = demo();
    const next = withDebtExtraBudget(h, 12500);
    expect(next.assumptions.debtExtraBudgetCents).toBe(12500);
    expect(withDebtExtraBudget(h, -5)).toBe(h);
    expect(withDebtExtraBudget(h, 1.5)).toBe(h);
    expect(h.assumptions.debtExtraBudgetCents).toBe(25000); // input unchanged
  });

  test("legacy households without the new fields read safe defaults", () => {
    const h = demo();
    const legacy = {
      ...h,
      goalContributions: undefined as unknown as typeof h.goalContributions,
      assumptions: { ...h.assumptions, debtExtraBudgetCents: undefined },
    };
    expect(householdGoalContributions(legacy)).toEqual([]);
    expect(debtExtraBudgetFor(legacy)).toBe(25000); // demo default
    const manualInputs: ManualOnboardingInputs = {
      availableCents: 180000,
      payDate: "2026-10-01",
      netPayCents: 215384,
      obligations: [
        { id: "ob-1", name: "Rent", amountCents: 90000, dueDay: 1 },
      ],
      essentialsPerCycleCents: 20000,
      bufferCents: 30000,
      goal: null,
      giving: { choice: "skip", fixedCents: null, percentBps: null },
    };
    const manual = manualHouseholdFor(manualInputs, "2026-09-12T10:00:00Z");
    expect(debtExtraBudgetFor(manual)).toBe(0); // manual default
  });
});

describe("seed goal contributions stay honest", () => {
  test("the demo confirmed contribution links to its evidence transaction", () => {
    const snapshot = createDemoSnapshot();
    const contrib = snapshot.goalContributions[0];
    expect(snapshot.goalContributions).toHaveLength(1);
    // Human copy names the record by amount/date — no internal raw id in copy.
    expect(contrib.note).toContain("transfer");
    expect(contrib.note).toContain("$200.00");
    expect(contrib.note).not.toContain("txn-");
    const transfer = snapshot.transactions.find(
      (t) => t.id === "txn-savings-xfer-0902",
    )!;
    expect(transfer.amountCents).toBe(-20000);
    expect(contrib.amountCents).toBe(20000);
  });
});