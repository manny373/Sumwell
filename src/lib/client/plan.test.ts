import { describe, expect, test } from "bun:test";
import {
  buildHomePlan,
  cycleDebtMinimums,
  daysUntilDue,
  debtMinimumAudit,
  givingForCycle,
  nextObligationDueOnOrAfter,
  payFrequencyFor,
} from "./plan";
import {
  demoHousehold,
  manualHouseholdFor,
  withAdoptedDebtExtra,
  withDebtExtraBudget,
} from "./household";
import { nextMonthlyOccurrence } from "./dates";
import type { Debt } from "~/lib/finance/types";
import type { ManualOnboardingInputs } from "./types";
import { createDemoSnapshot } from "~/lib/finance/seed";

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
    // Phase 4a: in-window DEBT MINIMUMS are now deducted exactly once
    // (card 9/22 $96.00 + federal 9/25 $145.00 + medical 9/15 $50.00 = $291.00;
    // auto's min is a future cycle, private's is due 9/28 after the window).
    //   1,799.94 − 358.70 − 291.00 − 250.00 − 200.00 − 60.00 − 300.00 = 340.24
    expect(plan.availableCents).toBe(179994);
    expect(plan.plan.obligationsDeductedCents).toBe(35870);
    expect(plan.plan.debtMinimumsCents).toBe(29100);
    expect(plan.debtMinimums.map((d) => d.name)).toEqual([
      "Minimum — Platinum Rewards Card",
      "Minimum — Federal Student Loans (Direct)",
      "Minimum — Medical Bill — Demo Clinic",
    ]);
    expect(plan.plan.essentialsCents).toBe(25000);
    expect(plan.plan.goalsCents).toBe(20000);
    expect(plan.plan.givingCents).toBe(6000);
    expect(plan.plan.bufferCents).toBe(30000);
    expect(plan.plan.remainingCents).toBe(34024);
    expect(plan.plan.isShortfall).toBe(false);
  });

  test("next obligation is Electric (due today, Sep 12) at $98.40", () => {
    const ctx = buildHomePlan(household, "2026-09-12");
    // Flat next-obligation shape: {name, amountCents, dueDate, kind}.
    expect(ctx.plan!.nextObligation!.name).toBe("Electric — Demo Utility");
    expect(ctx.plan!.nextObligation!.dueDate).toBe("2026-09-12");
    expect(ctx.plan!.nextObligation!.amountCents).toBe(9840);
    expect(ctx.plan!.nextObligation!.kind).toBe("obligation");
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
    expect(plan.debtMinimums).toEqual([]); // no debts → no minimums
    // 1,800 − 1,000 − 200 − 200 − 50 − 300 = 50
    expect(plan.plan.remainingCents).toBe(5000);
    expect(plan.plan.isShortfall).toBe(false);
  });

  test("next obligation picks the earliest due on/after today", () => {
    const ctx = buildHomePlan(household, "2026-09-12");
    // Electric (due day 15) comes before Rent's next occurrence (Oct 1).
    expect(ctx.plan!.nextObligation!.name).toBe("Electric");
    expect(ctx.plan!.nextObligation!.dueDate).toBe("2026-09-15");
    expect(ctx.plan!.nextObligation!.amountCents).toBe(10000);
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
    // Demo pays twice a month (10th & 25th): $120/month → $60 per check,
    // resolved through perCheckShare (12000 × 12 ÷ 24), never a blind ÷2.
    const payFrequency = payFrequencyFor(demo);
    expect(payFrequency).toBe("twiceMonthly");
    expect(givingForCycle(demo.givingPlan, payFrequency, 215384, 288462)).toBe(6000);
    expect(
      givingForCycle({ ...demo.givingPlan, enabled: false }, payFrequency, 215384, 288462),
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
    const a = nextObligationDueOnOrAfter(h, "2026-09-12");
    const b = nextObligationDueOnOrAfter(h, "2026-09-12");
    expect(a).toEqual(b);
    expect(a!.dueDate).toBe("2026-09-12");
    expect(a!.name).toBe("Electric — Demo Utility");
  });
});

/* ----------------------------------------- debt minimum audit (exactly-once) */

describe("debt minimum audit — exactly-once, no cross-obligation substitution", () => {
  test("seed audit: every debt lands in exactly one bucket; in-window = $291.00", () => {
    const h = demoHousehold();
    const audit = debtMinimumAudit(h);
    expect(audit).toHaveLength(5); // one row per seeded debt
    // Each debt appears exactly once.
    expect(new Set(audit.map((r) => r.debt.id)).size).toBe(audit.length);

    const byId = Object.fromEntries(audit.map((r) => [r.debt.id, r]));
    // Two creditors with different due days resolve to THEIR OWN dates.
    expect(byId["debt-card"].dueDay).toBe(22);
    expect(byId["debt-card"].dueDate).toBe("2026-09-22"); // own occurrence
    expect(byId["debt-card"].status).toBe("inWindow");
    expect(byId["debt-federal"].dueDate).toBe("2026-09-25");
    expect(byId["debt-federal"].status).toBe("inWindow");
    expect(byId["debt-medical"].dueDate).toBe("2026-09-15");
    expect(byId["debt-medical"].status).toBe("inWindow");
    expect(byId["debt-private"].dueDate).toBe("2026-09-28"); // after the window
    expect(byId["debt-private"].status).toBe("afterWindow");
    expect(byId["debt-auto"].status).toBe("afterWindow");
    // Auto's 9/5 payment predates the last received paycheck (9/10) — it
    // belongs to the previous cycle, so the NEXT minimum is a later cycle.
    expect(byId["debt-auto"].dueDate).toBe("2026-10-05");

    expect(audit.filter((r) => r.status === "inWindow").length).toBe(3);
    expect(audit.filter((r) => r.status === "afterWindow").length).toBe(2);
    expect(audit.filter((r) => r.status === "paidOnRecord").length).toBe(0);
    expect(audit.filter((r) => r.status === "noDueDate").length).toBe(0);

    // The plan deducts exactly the in-window minimums once.
    const minimums = cycleDebtMinimums(h);
    expect(minimums.reduce((s, d) => s + d.amountCents, 0)).toBe(29100); // 96+145+50
    expect(minimums.length).toBe(3);
  });

  test("each debt's audit date derives from ITS OWN due day (never a bill's)", () => {
    const h = demoHousehold();
    const lastReceived = "2026-09-10";
    for (const row of debtMinimumAudit(h)) {
      if (row.dueDay !== null && row.dueDate !== null) {
        expect(row.dueDate).toBe(
          nextMonthlyOccurrence(row.dueDay, lastReceived),
        );
      }
    }
  });

  test("31st-in-short-month clamps to the month end inside the audit", () => {
    const h: ReturnType<typeof demoHousehold> = {
      ...demoHousehold(),
      paychecks: [
        { id: "pc-a", date: "2026-04-10", employer: "E", grossCents: 100000, netCents: 80000, received: true, accountId: null, source: "demo" as const },
        { id: "pc-b", date: "2026-04-20", employer: "E", grossCents: 100000, netCents: 80000, received: true, accountId: null, source: "demo" as const },
        { id: "pc-c", date: "2026-05-01", employer: "E", grossCents: 100000, netCents: 80000, received: false, accountId: null, source: "demo" as const },
      ],
      // Only one debt: due day 31 with a $50 minimum. No account link, so no
      // seeded transaction can cover it as a paid-on-record payment.
      debts: [
        {
          id: "debt-x",
          name: "Day-31 card",
          category: "creditCard",
          balanceCents: 100000,
          accountId: null,
          aprBps: null,
          aprKind: "unknown",
          minPaymentCents: 5000,
          minPaymentIsEstimate: false,
          minPaymentDueDay: 31,
          source: "demo" as const,
        },
      ],
    };
    const row = debtMinimumAudit(h)[0];
    // April has 30 days → the 31st clamps to Apr 30; that lands INSIDE the
    // (Apr 20, May 1] window, so the minimum is deducted for this cycle.
    expect(row.dueDay).toBe(31);
    expect(row.dueDate).toBe("2026-04-30");
    expect(row.status).toBe("inWindow");
  });

  test("due date unknown → explicit noDueDate bucket, never substituted", () => {
    const h = demoHousehold();
    const unknown: Debt = {
      id: "debt-unknown",
      name: "Mystery card",
      category: "creditCard",
      balanceCents: 50000,
      accountId: null,
      aprBps: null,
      aprKind: "unknown",
      minPaymentCents: 2500,
      minPaymentIsEstimate: false,
      minPaymentDueDay: null, // unknown — never assumed
      source: "demo",
    };
    const withUnknown = { ...h, debts: [...h.debts, unknown] };
    const audit = debtMinimumAudit(withUnknown);
    const row = audit.find((r) => r.debt.id === "debt-unknown")!;
    expect(row.status).toBe("noDueDate");
    expect(row.dueDay).toBeNull();
    expect(row.dueDate).toBeNull();
    expect(row.representedWhere).toContain("due date unknown");
    // The unknown minimum is NEVER deducted and never substituted with a bill.
    const minimums = cycleDebtMinimums(withUnknown);
    expect(minimums.some((d) => d.debtId === "debt-unknown")).toBe(false);
    // And an absent field (undefined) behaves identically to null.
    const legacy: Debt = { ...unknown };
    delete legacy.minPaymentDueDay;
    const row2 = debtMinimumAudit({ ...h, debts: [...h.debts, legacy] }).find(
      (r) => r.debt.id === "debt-unknown",
    )!;
    expect(row2.status).toBe("noDueDate");
  });
});

/* ------------------------------------------- adoption: what-if vs adopted */

describe("adopted extra debt — flows into Home; what-if never does", () => {
  const demo = () => demoHousehold("2026-09-12T00:00:00Z");

  test("what-if budget changes never touch the Home plan or adopted totals", () => {
    const h = demo();
    const baseline = buildHomePlan(h, "2026-09-12").plan!;
    expect(baseline.plan.debtExtraCents).toBe(0);

    // Editing the what-if budget (Plan tab) must NOT leak into Home.
    const edited = withDebtExtraBudget(h, 50000);
    expect(edited.assumptions.debtExtraBudgetCents).toBe(50000);
    expect(edited.assumptions.adoptedDebtExtraCents).toBe(0); // untouched
    const plan = buildHomePlan(edited, "2026-09-12").plan!;
    expect(plan.plan.debtExtraCents).toBe(0);
    expect(plan.plan.remainingCents).toBe(34024); // unchanged
  });

  test("adoption flows into Home as a per-check share", () => {
    const h = withAdoptedDebtExtra(demo(), 20000); // $200/month adopted
    expect(h.assumptions.adoptedDebtExtraCents).toBe(20000);
    const plan = buildHomePlan(h, "2026-09-12").plan!;
    // $200/mo on twice-monthly pay = $100 per check (20000 × 12 ÷ 24).
    expect(plan.plan.debtExtraCents).toBe(10000);
    expect(plan.plan.remainingCents).toBe(24024); // 34024 − 10000
    expect(plan.plan.isShortfall).toBe(false);
    const extra = plan.plan.items.find((i) => i.kind === "debtExtra")!;
    expect(extra.amountCents).toBe(10000);
    expect(extra.deducted).toBe(true);
  });

  test("an unaffordable adoption produces a visible shortfall — never hidden", () => {
    const h = withAdoptedDebtExtra(demo(), 90000); // $900/month on $340.24 cycle room
    const plan = buildHomePlan(h, "2026-09-12").plan!;
    expect(plan.plan.debtExtraCents).toBe(45000); // per-check share
    expect(plan.plan.remainingCents).toBe(34024 - 45000);
    expect(plan.plan.isShortfall).toBe(true);
    expect(plan.plan.shortfallCents).toBe(10976);
  });

  test("withAdoptedDebtExtra rejects non-integer and negative amounts", () => {
    const h = demo();
    expect(withAdoptedDebtExtra(h, -1)).toBe(h); // unchanged reference
    expect(withAdoptedDebtExtra(h, 12.5)).toBe(h);
    expect(h.assumptions.adoptedDebtExtraCents).toBe(0); // nothing adopted
  });
});

/* ------------------------------------------- cross-obligation substitution */

describe("no cross-obligation substitution over the seed", () => {
  test("debt minimums always come from the debt's own due day", () => {
    const seed = createDemoSnapshot();
    const received = seed.paychecks.filter((p) => p.received);
    const windowStart = received[received.length - 1].date;
    for (const debt of seed.debts) {
      if (debt.minPaymentDueDay == null) continue;
      const expected = nextMonthlyOccurrence(debt.minPaymentDueDay, windowStart);
      const audit = debtMinimumAudit(demoHousehold()).find(
        (r) => r.debt.id === debt.id,
      );
      // The audit row is either that exact occurrence (in/after window) or
      // a covered payment — it is never another obligation's date.
      expect(audit!.dueDate === expected || audit!.status === "paidOnRecord").toBe(true);
    }
    // The next-obligation list includes debt minimums as their OWN rows.
    const next = nextObligationDueOnOrAfter(demoHousehold(), "2026-09-12");
    expect(next!.kind).toBe("obligation"); // Electric is due first
    // Between Sep 20 (gym) and Oct 1 (rent) the earliest due item is the
    // federal minimum on Sep 25 — no obligation is due in that stretch.
    const later = nextObligationDueOnOrAfter(demoHousehold(), "2026-09-23");
    expect(later!.kind).toBe("debtMinimum");
    expect(later!.name).toBe("Minimum — Federal Student Loans (Direct)");
    expect(later!.dueDate).toBe("2026-09-25");
  });
});