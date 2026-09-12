import { describe, expect, test } from "bun:test";
import {
  buildHomePlan,
  daysUntilDue,
  givingForCycle,
  nextObligationDueOnOrAfter,
} from "./plan";
import { demoHousehold, manualHouseholdFor } from "./household";
import type { ManualOnboardingInputs } from "./types";

/* ------------------------------------------------------------------ demo */

describe("demo household Home plan (hand-worked arithmetic)", () => {
  const household = demoHousehold("2026-09-12T00:00:00Z");

  test("next paycheck is the first unreceived one, 13 days out", () => {
    const ctx = buildHomePlan(household, "2026-09-12");
    expect(ctx.reason).toBe("ok");
    const plan = ctx.plan!;
    expect(plan.paycheck.date).toBe("2026-09-25");
    expect(plan.paycheck.received).toBe(false);
    expect(plan.incomeUncertain).toBe(true);
    expect(plan.daysUntilPaycheck).toBe(13);
  });

  test("window holds exactly the 6 bills due between the Sep 10 and Sep 25 paychecks", () => {
    const ctx = buildHomePlan(household, "2026-09-12");
    const names = ctx.plan!.obligations.map((o) => o.name).sort();
    expect(names).toEqual([
      "Auto insurance (demo)",
      "Electric — Demo Utility",
      "Gym — Demo Fitness",
      "Internet — Demo Fiber",
      "Music (demo)",
      "Streaming (demo)",
    ]);
    // 98.40 + 69.99 + 118.33 + 45.00 + 10.99 + 15.99 == 358.70
    const total = ctx.plan!.obligations.reduce((s, o) => s + o.amountCents, 0);
    expect(total).toBe(35870);
    // Rent (due the 1st) and Mobile (due the 8th) fall OUTSIDE the window.
    expect(ctx.plan!.obligations.some((o) => o.name.startsWith("Rent"))).toBe(false);
    expect(ctx.plan!.obligations.some((o) => o.name.startsWith("Mobile"))).toBe(false);
  });

  test("remaining money matches the hand-worked equation, healthy", () => {
    const plan = buildHomePlan(household, "2026-09-12").plan!;
    // 1,799.94 − 358.70 − 250.00 − 200.00 − 60.00 − 300.00 = 631.24
    expect(plan.availableCents).toBe(179994);
    expect(plan.plan.obligationsDeductedCents).toBe(35870);
    expect(plan.plan.essentialsCents).toBe(25000);
    expect(plan.plan.goalsCents).toBe(20000);
    expect(plan.plan.givingCents).toBe(6000);
    expect(plan.plan.bufferCents).toBe(30000);
    expect(plan.plan.remainingCents).toBe(63124);
    expect(plan.plan.isShortfall).toBe(false);
  });

  test("next obligation is Electric (due today, Sep 12) at $98.40", () => {
    const ctx = buildHomePlan(household, "2026-09-12");
    expect(ctx.plan!.nextObligation!.obligation.name).toBe("Electric — Demo Utility");
    expect(ctx.plan!.nextObligation!.dueDate).toBe("2026-09-12");
    expect(ctx.plan!.nextObligation!.obligation.amountCents).toBe(9840);
    expect(daysUntilDue("2026-09-12", "2026-09-12")).toBe(0);
  });

  test("once the modeled payday passes, the data is stale — no estimates", () => {
    const ctx = buildHomePlan(household, "2026-09-26");
    expect(ctx.reason).toBe("stale");
    expect(ctx.plan).toBeNull();
  });

  test("on payday itself the plan still holds with 0 days away", () => {
    const ctx = buildHomePlan(household, "2026-09-25");
    expect(ctx.reason).toBe("ok");
    expect(ctx.plan!.daysUntilPaycheck).toBe(0);
  });
});

/* ----------------------------------------------------------------- manual */

const inputs: ManualOnboardingInputs = {
  availableCents: 180000,
  payDate: "2026-10-01",
  netPayCents: 215384,
  obligations: [
    { id: "ob-1", name: "Rent", amountCents: 90000, dueDay: 1 },
    { id: "ob-2", name: "Electric", amountCents: 10000, dueDay: 15 },
  ],
  essentialsPerCycleCents: 20000,
  bufferCents: 30000,
  goal: { name: "Emergency fund", targetCents: 1000000, perCycleCents: 20000 },
  giving: { choice: "fixed", fixedCents: 5000, percentBps: null },
};

describe("manual household Home plan (hand-worked arithmetic)", () => {
  const household = manualHouseholdFor(inputs, "2026-09-12T10:00:00Z");

  test("covers every entered obligation and lands on the hand-worked remaining", () => {
    const ctx = buildHomePlan(household, "2026-09-12");
    expect(ctx.reason).toBe("ok");
    const plan = ctx.plan!;
    expect(plan.paycheck.date).toBe("2026-10-01");
    expect(plan.daysUntilPaycheck).toBe(19);
    expect(plan.obligations).toHaveLength(2);
    // 1,800 − 1,000 − 200 − 200 − 50 − 300 = 50
    expect(plan.plan.remainingCents).toBe(5000);
    expect(plan.plan.isShortfall).toBe(false);
  });

  test("next obligation picks the earliest due on/after today", () => {
    const ctx = buildHomePlan(household, "2026-09-12");
    // Electric (due day 15) comes before Rent's next occurrence (Oct 1).
    expect(ctx.plan!.nextObligation!.obligation.name).toBe("Electric");
    expect(ctx.plan!.nextObligation!.dueDate).toBe("2026-09-15");
    expect(daysUntilDue("2026-09-15", "2026-09-12")).toBe(3);
  });

  test("10% giving of net produces an exact integer shortfall when tight", () => {
    const tight = manualHouseholdFor(
      { ...inputs, giving: { choice: "percent", fixedCents: null, percentBps: 1000 } },
      "2026-09-12T10:00:00Z",
    );
    const ctx = buildHomePlan(tight, "2026-09-12");
    const plan = ctx.plan!;
    // 10% of $2,153.84 = $215.38 (21538 cents — exact integer rounding).
    expect(plan.givingCents).toBe(21538);
    // 180,000 − 100,000 − 20,000 − 20,000 − 21,538 − 30,000 = −11,538
    expect(plan.plan.remainingCents).toBe(-11538);
    expect(plan.plan.isShortfall).toBe(true);
    expect(plan.plan.shortfallCents).toBe(11538);
  });

  test("skipped giving is absent from the equation", () => {
    const noGive = manualHouseholdFor(
      { ...inputs, giving: { choice: "skip", fixedCents: null, percentBps: null } },
      "2026-09-12T10:00:00Z",
    );
    const plan = buildHomePlan(noGive, "2026-09-12").plan!;
    expect(plan.givingCents).toBeNull();
    expect(plan.plan.givingCents).toBe(0);
    // 180,000 − 100,000 − 20,000 − 20,000 − 30,000 = 10,000
    expect(plan.plan.remainingCents).toBe(10000);
  });
});

/* ------------------------------------------------------ edge / honesty */

describe("plan honesty states", () => {
  test("givingForCycle: disabled plan → null, monthly fixed splits per check", () => {
    const demo = demoHousehold();
    expect(demo.givingPlan.enabled).toBe(true);
    expect(givingForCycle(demo.givingPlan, 215384)).toBe(6000); // $120/mo → $60/check
    expect(
      givingForCycle({ ...demo.givingPlan, enabled: false }, 215384),
    ).toBeNull();
  });

  test("no unreceived paycheck → no-paycheck reason", () => {
    const h = demoHousehold();
    const ctx = buildHomePlan(
      { ...h, paychecks: h.paychecks.map((p) => ({ ...p, received: true })) },
      "2026-09-12",
    );
    expect(ctx.reason).toBe("no-paycheck");
    expect(ctx.plan).toBeNull();
  });

  test("no checking balance anywhere → no-balance, never an invented 0", () => {
    const h = manualHouseholdFor(inputs, "2026-09-12T10:00:00Z");
    const ctx = buildHomePlan(
      {
        ...h,
        accounts: h.accounts.map((a) => ({
          ...a,
          availableBalanceCents: null,
          currentBalanceCents: null,
        })),
      },
      "2026-09-12",
    );
    expect(ctx.reason).toBe("no-balance");
    expect(ctx.plan).toBeNull();
  });

  test("nextObligationDueOnOrAfter skips nothing and stays deterministic", () => {
    const h = demoHousehold();
    const a = nextObligationDueOnOrAfter(h.obligations, "2026-09-12");
    const b = nextObligationDueOnOrAfter(h.obligations, "2026-09-12");
    expect(a).toEqual(b);
    expect(a!.dueDate).toBe("2026-09-12");
  });
});