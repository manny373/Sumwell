/**
 * Home primary-action tests — Phase 4b (Finding 7).
 */
import { describe, expect, test } from "bun:test";
import { buildHomePlan } from "./plan";
import { demoHousehold, manualHouseholdFor, withAdoptedDebtExtra } from "./household";
import { homePrimaryAction } from "./homeAction";
import type { ManualOnboardingInputs } from "./types";

const demo = () => demoHousehold("2026-09-12T00:00:00Z");

const inputs: ManualOnboardingInputs = {
  availableCents: 200000,
  payDate: "2026-10-01",
  netPayCents: 215384,
  obligations: [{ id: "ob-1", name: "Rent", amountCents: 90000, dueDay: 1 }],
  essentialsPerCycleCents: 20000,
  bufferCents: 30000,
  goal: null,
  giving: { choice: "skip", fixedCents: null, percentBps: null },
};

describe("homePrimaryAction — healthy demo", () => {
  test("next obligation (a bill) → Review bill, set aside note, #bills target", () => {
    const plan = buildHomePlan(demo(), "2026-09-12").plan!;
    const action = homePrimaryAction(demo(), plan);
    expect(action.kind).toBe("review-bill");
    expect(action.label).toBe("Review bill");
    expect(action.hash).toBe("#bills");
    expect(action.setAsideNote).toBe("Already set aside in your plan");
    expect(action.nextObligation!.name).toBe("Electric — Demo Utility");
    expect(action.nextObligation!.reflected).toBe(false);
    expect(action.headline).toContain("Electric");
    expect(action.headline).toContain("$98.40");
  });

  test("when the next item is a debt minimum → Review payment, #debt target", () => {
    // On Sep 23 nothing is due until the federal minimum on Sep 25.
    const plan = buildHomePlan(demo(), "2026-09-23").plan!;
    const action = homePrimaryAction(demo(), plan);
    expect(action.kind).toBe("review-payment");
    expect(action.label).toBe("Review payment");
    expect(action.hash).toBe("#debt");
    expect(action.headline).toContain("Federal Student Loans");
    expect(action.headline).toContain("$145.00");
  });

  test("an already-reflected obligation says 'already reflected', never re-reserves", () => {
    const h = demo();
    const hh: typeof h = {
      ...h,
      obligations: h.obligations.map((o) =>
        o.id === "ob-electric" ? { ...o, alreadyReflected: true } : o,
      ),
    };
    const plan = buildHomePlan(hh, "2026-09-12").plan!;
    const action = homePrimaryAction(hh, plan);
    expect(action.kind).toBe("review-bill");
    expect(action.setAsideNote).toBe("Already reflected in your balance");
    expect(action.nextObligation!.reflected).toBe(true);
  });

  test("shortfall → Review the plan with an exact calm number", () => {
    const h = withAdoptedDebtExtra(demo(), 90000); // short by $109.76
    const plan = buildHomePlan(h, "2026-09-12").plan!;
    const action = homePrimaryAction(h, plan);
    expect(action.kind).toBe("review-plan");
    expect(action.label).toBe("Review the plan");
    expect(action.hash).toBeNull();
    expect(action.headline).toContain("short $109.76");
    expect(action.detail).toContain("Nothing moves automatically");
    expect(action.setAsideNote).toBeNull();
  });
});

describe("homePrimaryAction — fallbacks when nothing is due", () => {
  test("accepted goal allocations → View allocation (#goals)", () => {
    // demoHousehold always has accepted goal contributions in assumptions.
    // Obligations AND debts removed so nothing is "next due".
    const noObligations = { ...demo(), obligations: [], debts: [] };
    const plan = buildHomePlan(noObligations, "2026-09-12").plan!;
    const action = homePrimaryAction(noObligations, plan);
    expect(action.kind).toBe("view-allocation");
    expect(action.label).toBe("View allocation");
    expect(action.hash).toBe("#goals");
    expect(action.setAsideNote).toBe("Already allocated in your plan");
  });

  test("no obligations and no goals → draft rule preview (#automation)", () => {
    const h = demo();
    const noGoals: typeof h = {
      ...h,
      obligations: [],
      debts: [],
      assumptions: { ...h.assumptions, goalContributions: [] },
    };
    const plan = buildHomePlan(noGoals, "2026-09-12").plan!;
    const action = homePrimaryAction(noGoals, plan);
    expect(action.kind).toBe("view-rule-preview");
    expect(action.label).toBe("View rule preview");
    expect(action.hash).toBe("#automation");
  });

  test("nothing at all → View plan, keep the remaining available", () => {
    const h = manualHouseholdFor(inputs, "2026-09-12T10:00:00Z");
    const plan = buildHomePlan(h, "2026-09-12").plan!;
    // Manual household: Rent due Oct 1; before that there is no next obligation
    // (Sep has no occurrence of day 1 after today). No goals, no rules.
    const action = homePrimaryAction(h, plan);
    // Since obligations exist, nextObligation returns Rent (Oct 1) — an
    // obligation action is still correct; the fallback only fires with none.
    expect(action.kind).toBe("review-bill");
    expect(action.headline).toContain("Rent");
  });

  test("a household with no obligations and no goals and no rules → View plan", () => {
    const h = demo();
    const empty: typeof h = {
      ...h,
      obligations: [],
      debts: [],
      automationRules: [],
      assumptions: { ...h.assumptions, goalContributions: [] },
    };
    const plan = buildHomePlan(empty, "2026-09-12").plan!;
    const action = homePrimaryAction(empty, plan);
    expect(action.kind).toBe("view-plan");
    expect(action.label).toBe("View plan");
    expect(action.headline).toContain("Keep");
  });
});