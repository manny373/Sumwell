import { describe, expect, test } from "bun:test";
import type { AutomationRule, GivingPlan } from "~/lib/finance/types";
import { demoHousehold, manualHouseholdFor } from "./household";
import {
  automationRuleViews,
  cycleObligationsView,
  debtGroupName,
  debtStrategyView,
  givingView,
  goalViews,
  projectedGoalContributions,
} from "./planScreen";
import type { ManualOnboardingInputs } from "./types";

/* ------------------------------------------------------------- demo ---- */

const demo = () => demoHousehold("2026-09-12T00:00:00Z");

describe("cycle obligations view — exactly-once semantics", () => {
  test("demo cycle totals match the hand-worked Home window", () => {
    const view = cycleObligationsView(demo());
    expect(view.obligations).toHaveLength(6);
    expect(view.totalCents).toBe(35870); // $358.70
    expect(view.deductedCents).toBe(35870);
    expect(view.reflectedCents).toBe(0);
    expect(view.reflectedCount).toBe(0);
    expect(view.windowStart).toBe("2026-09-10");
    expect(view.windowEnd).toBe("2026-09-25");
  });

  test("already-reflected obligations are shown but NEVER double-deducted", () => {
    const h = demo();
    const modified = {
      ...h,
      obligations: h.obligations.map((o) =>
        o.id === "ob-electric" ? { ...o, alreadyReflected: true } : o,
      ),
    };
    const view = cycleObligationsView(modified);
    const reflected = view.obligations.find((o) => o.alreadyReflected)!;
    expect(reflected).toBeDefined();
    expect(reflected.id).toBe("ob-electric");
    expect(view.reflectedCents).toBe(reflected.amountCents);
    expect(view.reflectedCount).toBe(1);
    expect(view.deductedCents + view.reflectedCents).toBe(view.totalCents);
  });
});

describe("debt strategy view", () => {
  test("demo defaults: extra budget from assumptions, monthly cash emphasized", () => {
    const view = debtStrategyView(demo(), "2026-09-12");
    expect(view.extraBudgetCents).toBe(25000); // $250/mo demo assumption
    // minimums 96.00 + 312.40 + 145.00 + 232.00 + 50.00 = $835.40
    expect(view.minimumsCents).toBe(83540);
    expect(view.monthlyTotalCents).toBe(108540); // + $250 extra
    // Medical bill has unknown APR → interest is never presented as complete.
    expect(view.comparison.avalanche.interestComplete).toBe(false);
    expect(view.comparison.avalanche.totalInterestCents).toBeNull();
    expect(view.comparison.avalanche.totalInterestKnownCents).toBeGreaterThan(0);
    expect(view.comparison.avalanche.truncated).toBe(false);
    expect(view.comparison.avalanche.lastPayoffDate).not.toBeNull();
    // Strategies share the same debts but the order differs: avalanche retires
    // the highest-APR debt (card) first.
    const cardAvalanche = view.comparison.avalanche.payoffRows.find(
      (r) => r.debtId === "debt-card",
    )!;
    const cardSnowball = view.comparison.snowball.payoffRows.find(
      (r) => r.debtId === "debt-card",
    )!;
    expect(cardAvalanche.payoffMonth as number).toBeLessThan(
      cardSnowball.payoffMonth as number,
    );
  });

  test("editing the extra budget down to $0 changes the monthly commitment", () => {
    const h = { ...demo(), assumptions: { ...demo().assumptions, debtExtraBudgetCents: 0 } };
    const view = debtStrategyView(h, "2026-09-12");
    expect(view.extraBudgetCents).toBe(0);
    expect(view.monthlyTotalCents).toBe(view.minimumsCents);
  });

  test("unknown-APR debt is flagged, never given an invented interest number", () => {
    const view = debtStrategyView(demo(), "2026-09-12");
    for (const strategy of [view.comparison.avalanche, view.comparison.snowball]) {
      const medical = strategy.payoffRows.find((r) => r.debtId === "debt-medical")!;
      expect(medical.interestCents).toBeNull();
      expect(medical.interestIgnored).toBe(true);
      expect(medical.payoffDateIsEstimate).toBe(true);
      expect(strategy.estimateNotes.some((n) => n.includes("unknown APR"))).toBe(true);
    }
  });

  test("student loans group separately: federal vs private", () => {
    const h = demo();
    const federal = h.debts.find((d) => d.id === "debt-federal")!;
    const priv = h.debts.find((d) => d.id === "debt-private")!;
    const card = h.debts.find((d) => d.id === "debt-card")!;
    expect(debtGroupName(federal)).toBe("Federal student loans");
    expect(debtGroupName(priv)).toBe("Private student loans");
    expect(debtGroupName(card)).toBe("Other debts");
  });
});

describe("savings goals view", () => {
  test("priority order, accepted allocations labeled, projections separate", () => {
    const views = goalViews(demo());
    expect(views.map((v) => v.goal.percentCompleteBps)).toEqual([5633, 2500]);
    const emergency = views.find((v) => v.goal.goal.id === "goal-emergency")!;
    expect(emergency.acceptedCents).toBe(20000); // assumed per-cycle allocation
    // Confirmed history: ONE dated deposit on Sep 2; the projection is separate.
    expect(emergency.goal.confirmedHistory).toHaveLength(1);
    expect(emergency.goal.confirmedHistory[0]).toEqual({
      date: "2026-09-02",
      contributionCents: 20000,
      runningTotalCents: 20000,
    });
    expect(emergency.goal.projected).toHaveLength(1);
    expect(emergency.goal.projected[0].amountCents).toBe(20000);
    expect(emergency.goal.projected[0].date).toBe("2026-09-25");
    expect(emergency.goal.confirmedTotalCents).toBe(20000);
    expect(emergency.goal.projectedTotalCents).toBe(20000); // kept separate
    // The goal's current balance is the source of truth, not the history.
    expect(emergency.goal.currentSavedCents).toBe(845000);
  });

  test("home repair has no confirmed history and no projection — no invention", () => {
    const repair = goalViews(demo()).find((v) => v.goal.goal.id === "goal-homerepair")!;
    expect(repair.acceptedCents).toBe(0);
    expect(repair.goal.confirmedHistory).toEqual([]);
    expect(repair.goal.projected).toEqual([]);
    expect(repair.goal.currentSavedCents).toBe(125000);
  });
});

describe("giving view", () => {
  test("demo fixed monthly $120 → per-check $60 with factual impact", () => {
    const view = givingView(demo());
    expect(view.cycleGivingCents).toBe(6000); // per-check share
    expect(view.impact!.givingCents).toBe(12000); // plan-level (monthly)
    expect(view.scheduleLabel).toBe("monthly");
    expect(view.basisLabel).toBe("net pay");
    expect(view.billsMonthlyCents).toBe(212120); // all 8 monthly bills
    expect(view.goalsMonthlyCents).toBe(40000); // $200/cycle × 2 checks
    // 12000 / (212120+40000) = 4.76% — labelled estimate, factual arithmetic.
    expect(view.impact!.shareOfCommitmentsBps).toBe(476);
    expect(view.impact!.percentBps).toBe(557); // 120/2153.84 ≈ 5.57% of net
    expect(view.impact!.skipped).toBe(false);
  });

  test("a skipped/disabled plan shows skipped and never invents a gift", () => {
    const h = demo();
    const off: GivingPlan = { ...h.givingPlan, enabled: false };
    const view = givingView({ ...h, givingPlan: off });
    expect(view.cycleGivingCents).toBeNull();
    expect(view.impact!.givingCents).toBe(0);
    expect(view.impact!.skipped).toBe(true);
  });

  test("percent giving view computes the cycle amount off net pay", () => {
    const h = demo();
    const pct: GivingPlan = {
      ...h.givingPlan,
      mode: "percent",
      amountCents: null,
      percentBps: 1000,
      schedule: "perPaycheck",
    };
    const view = givingView({ ...h, givingPlan: pct });
    expect(view.cycleGivingCents).toBe(21538); // 10% of $2,153.84 net
    expect(view.impact!.givingCents).toBe(21538);
    expect(view.impact!.percentBps).toBe(1000);
    expect(view.amountNote).toBe("10% of net pay");
  });
});

describe("automation rule previews (simulated, data only)", () => {
  test("every seeded rule resolves an amount, a trigger, and a funds check", () => {
    const views = automationRuleViews(demo(), "2026-09-12");
    expect(views).toHaveLength(3);
    for (const v of views) {
      expect(v.rule.simulated).toBe(true);
      expect(v.paused).toBe(false);
      expect(v.wouldMoveCents).not.toBeNull();
      expect(v.triggerDate).not.toBeNull();
      expect(v.sourceAccount).not.toBeNull();
      expect(v.sufficient).not.toBeNull();
    }
  });

  test("emergency rule: $200 from checking → savings, day after next paycheck", () => {
    const view = automationRuleViews(demo(), "2026-09-12").find(
      (v) => v.rule.id === "rule-emergency",
    )!;
    expect(view.wouldMoveCents).toBe(20000);
    expect(view.triggerDate).toBe("2026-09-26"); // 9/25 + 1
    expect(view.sourceAccount!.id).toBe("acc-checking");
    expect(view.destinationAccount!.id).toBe("acc-savings");
    expect(view.sourceAvailableCents).toBe(179994);
    expect(view.maxCents).toBe(40000);
    // Funds check: outflows through 9/26 never dip below zero.
    expect(view.sufficient).toBe(true);
    expect(view.triggerDay!.lowCents).toBeGreaterThanOrEqual(0);
    // The paycheck hasn't arrived → the preview is visibly income-uncertain.
    expect(view.incomeUncertain).toBe(true);
    expect(view.forecast!.incomeUncertain).toBe(true);
  });

  test("formula rule resolves the linked debt's minimum payment", () => {
    const view = automationRuleViews(demo(), "2026-09-12").find(
      (v) => v.rule.id === "rule-cc-min",
    )!;
    expect(view.linkedDebt!.id).toBe("debt-card");
    expect(view.wouldMoveCents).toBe(9600); // statement minimum (estimate)
    expect(view.amountLabel).toContain("Minimum payment");
    // "on due date" → modeled as the next bill due from today (Electric, due 12th).
    expect(view.triggerDate).toBe("2026-09-12");
    expect(view.triggerLabel).toContain("Electric");
    expect(view.sufficient).toBe(true);
  });

  test("a rule that outruns the balance flags insufficiency (would pause)", () => {
    const h = demo();
    const rule: AutomationRule = {
      id: "rule-big",
      name: "Big transfer (test)",
      sourceAccountId: "acc-checking",
      destinationAccountId: "acc-savings",
      amountType: "fixed",
      amountCents: 20000,
      percentBps: null,
      formula: null,
      maxCents: 20000,
      schedule: "perPaycheck",
      offsetDays: 0,
      status: "draft",
      simulated: true,
      authorizedAt: null,
      revokedAt: null,
      source: "demo",
    };
    const broke = {
      ...h,
      accounts: h.accounts.map((a) =>
        a.id === "acc-checking"
          ? { ...a, availableBalanceCents: 8000, currentBalanceCents: 8000 }
          : a,
      ),
      automationRules: [rule],
    };
    const view = automationRuleViews(broke, "2026-09-12")[0];
    // $80 available, $200 rule on the 25th, paycheck 9/25 arrives same day —
    // the rule amount exceeds the low balance day-of → insufficient.
    expect(view.sufficient).toBe(false);
    expect(view.forecast!.anyShortfall).toBe(true);
  });

  test("paused rules keep their data but are flagged; stale triggers say so", () => {
    const h = demo();
    const paused = {
      ...h,
      automationRules: h.automationRules.map((r) => ({
        ...r,
        status: "paused" as const,
      })),
    };
    const views = automationRuleViews(paused, "2026-09-12");
    expect(views.every((v) => v.paused)).toBe(true);
    expect(views[0].sufficient).not.toBeNull(); // preview math still computed

    const stale = automationRuleViews(h, "2026-09-30"); // after modeled payday
    expect(stale[0].stale).toBe(true);
    expect(stale[0].sufficient).toBeNull();
  });

  test("percent rules resolve off next net pay; formula without a debt stays unresolved", () => {
    const h = demo();
    const pctRule: AutomationRule = {
      ...h.automationRules[0],
      id: "rule-pct",
      amountType: "percent",
      amountCents: null,
      percentBps: 1000,
    };
    const orphan: AutomationRule = {
      ...h.automationRules[1],
      id: "rule-orphan",
      linkedDebtId: null,
    };
    const views = automationRuleViews(
      { ...h, automationRules: [pctRule, orphan] },
      "2026-09-12",
    );
    const pct = views.find((v) => v.rule.id === "rule-pct")!;
    expect(pct.wouldMoveCents).toBe(21538);
    expect(pct.amountLabel).toBe("10% of net pay");
    const formula = views.find((v) => v.rule.id === "rule-orphan")!;
    expect(formula.wouldMoveCents).toBeNull();
    expect(formula.unresolved).toContain("no linked debt");
    expect(formula.sufficient).toBeNull();
  });
});

describe("manual household plan views", () => {
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

  test("no debts, no rules, no confirmed contributions — honest empty paths", () => {
    const h = manualHouseholdFor(inputs, "2026-09-12T10:00:00Z");
    const cycle = cycleObligationsView(h);
    expect(cycle.obligations).toHaveLength(2);
    expect(cycle.totalCents).toBe(100000);
    expect(debtStrategyView(h, "2026-09-12").comparison.avalanche.payoffRows).toEqual([]);
    expect(automationRuleViews(h, "2026-09-12")).toEqual([]);
    expect(goalViews(h)[0].goal.confirmedHistory).toEqual([]);
    expect(projectedGoalContributions(h)).toHaveLength(1); // the accepted goal
    const giving = givingView(h);
    expect(giving.cycleGivingCents).toBe(5000); // perPaycheck fixed
    expect(giving.impact!.givingCents).toBe(5000);
    expect(giving.goalsMonthlyCents).toBe(20000); // 1 cycle/month for manual
  });
});