import { describe, expect, test } from "bun:test";
import { createDemoSnapshot } from "~/lib/finance/seed";
import { demoHousehold, manualHouseholdFor } from "./household";
import type { ManualOnboardingInputs } from "./types";

describe("demoHousehold", () => {
  test("wraps the frozen snapshot without changing any seeded value", () => {
    const snapshot = createDemoSnapshot();
    const household = demoHousehold("2026-09-12T00:00:00Z");
    expect(household.source).toBe("demo");
    expect(household.createdAt).toBe("2026-09-12T00:00:00Z");
    expect(household.generatedAt).toBe(snapshot.generatedAt);
    expect(household.accounts).toEqual(snapshot.accounts);
    expect(household.paychecks).toEqual(snapshot.paychecks);
    expect(household.obligations).toEqual(snapshot.obligations);
    expect(household.goals).toEqual(snapshot.goals);
  });

  test("carries the demo plan assumptions (hand-checked values)", () => {
    const household = demoHousehold();
    expect(household.assumptions.essentialsPerCycleCents).toBe(25000); // $250
    expect(household.assumptions.bufferCents).toBe(30000); // $300
    expect(household.assumptions.goalContributions).toEqual([
      { goalId: "goal-emergency", name: "Emergency fund", amountCents: 20000 },
    ]);
    expect(household.assumptions.debtExtraBudgetCents).toBe(25000); // $250/mo
  });

  test("carries the confirmed goal contributions from the snapshot", () => {
    const household = demoHousehold();
    const snapshot = createDemoSnapshot();
    expect(household.goalContributions).toEqual(snapshot.goalContributions);
    expect(household.goalContributions).toHaveLength(1);
    expect(household.goalContributions[0]).toMatchObject({
      goalId: "goal-emergency",
      amountCents: 20000,
      confirmed: true,
      date: "2026-09-02",
    });
  });
});

const baseInputs: ManualOnboardingInputs = {
  availableCents: 180000,
  payDate: "2026-10-01",
  netPayCents: 215384,
  obligations: [
    { id: "ob-1", name: "Rent", amountCents: 90000, dueDay: 1 },
    { id: "ob-2", name: "Electric", amountCents: 10000, dueDay: 15 },
  ],
  essentialsPerCycleCents: 20000,
  bufferCents: 30000,
  goal: {
    name: "Emergency fund",
    targetCents: 1000000,
    perCycleCents: 20000,
  },
  giving: { choice: "fixed", fixedCents: 5000, percentBps: null },
};

describe("manualHouseholdFor", () => {
  test("synthesizes every entity with source manual and integer cents", () => {
    const h = manualHouseholdFor(baseInputs, "2026-09-12T10:00:00Z");
    expect(h.source).toBe("manual");
    expect(h.generatedAt).toBe("2026-09-12T10:00:00Z");
    expect(h.createdAt).toBe("2026-09-12T10:00:00Z");
    expect(h.label).toBe("Your household");

    const checking = h.accounts[0];
    expect(checking.type).toBe("checking");
    expect(checking.connectionStatus).toBe("manual");
    expect(checking.availableBalanceCents).toBe(180000);
    expect(checking.currentBalanceCents).toBe(180000);

    expect(h.paychecks).toHaveLength(1);
    const pay = h.paychecks[0];
    expect(pay.received).toBe(false);
    expect(pay.netCents).toBe(215384);
    expect(pay.date).toBe("2026-10-01");

    expect(h.obligations.map((o) => [o.name, o.amountCents, o.dueDay])).toEqual([
      ["Rent", 90000, 1],
      ["Electric", 10000, 15],
    ]);
    for (const o of h.obligations) {
      expect(o.source).toBe("manual");
      expect(o.cadence).toBe("monthly");
      expect(o.essential).toBe(true);
      expect(o.alreadyReflected).toBe(false);
    }

    expect(h.goals).toEqual([
      {
        id: "goal-manual",
        name: "Emergency fund",
        kind: "custom",
        targetCents: 1000000,
        savedCents: 0,
        priority: 1,
        source: "manual",
      },
    ]);

    expect(h.givingPlan).toMatchObject({
      mode: "fixed",
      amountCents: 5000,
      percentBps: null,
      enabled: true,
      // Per-check giving is stored at the plan's own cadence (declared
      // assumption — "every 2 weeks") because no pay schedule is on record.
      frequency: "biweekly",
      source: "manual",
    });

    expect(h.assumptions).toEqual({
      essentialsPerCycleCents: 20000,
      bufferCents: 30000,
      goalContributions: [
        { goalId: "goal-manual", name: "Emergency fund", amountCents: 20000 },
      ],
      debtExtraBudgetCents: 0,
      adoptedDebtExtraCents: 0, // a what-if budget is never adopted implicitly
    });
    expect(h.transactions).toEqual([]);
    expect(h.debts).toEqual([]);
    expect(h.goalContributions).toEqual([]);
  });

  test("percent giving stores basis points and stays enabled", () => {
    const h = manualHouseholdFor(
      { ...baseInputs, giving: { choice: "percent", fixedCents: null, percentBps: 1000 } },
      "2026-09-12T10:00:00Z",
    );
    expect(h.givingPlan).toMatchObject({
      mode: "percent",
      percentBps: 1000,
      amountCents: null,
      enabled: true,
      basis: "net",
    });
  });

  test("skipped giving produces a disabled plan with no amount", () => {
    const h = manualHouseholdFor(
      { ...baseInputs, giving: { choice: "skip", fixedCents: null, percentBps: null } },
      "2026-09-12T10:00:00Z",
    );
    expect(h.givingPlan.enabled).toBe(false);
    expect(h.givingPlan.amountCents).toBeNull();
    expect(h.givingPlan.percentBps).toBeNull();
  });

  test("no goal yields no goal records and no accepted contributions", () => {
    const h = manualHouseholdFor(
      { ...baseInputs, goal: null },
      "2026-09-12T10:00:00Z",
    );
    expect(h.goals).toEqual([]);
    expect(h.assumptions.goalContributions).toEqual([]);
  });

  test("preserves createdAt when editing an existing household", () => {
    const h = manualHouseholdFor(
      { ...baseInputs, createdAt: "2026-09-01T00:00:00Z" },
      "2026-09-12T10:00:00Z",
    );
    expect(h.createdAt).toBe("2026-09-01T00:00:00Z");
    expect(h.generatedAt).toBe("2026-09-12T10:00:00Z");
  });
});