import { describe, expect, test } from "bun:test";
import { demoHousehold, manualHouseholdFor } from "./household";
import {
  allConfirmedChanges,
  checkInSummary,
  confirmedDebtChanges,
  confirmedGoalChanges,
  goalProgressViews,
} from "./progress";
import type { ManualOnboardingInputs } from "./types";

const demo = () => demoHousehold("2026-09-12T00:00:00Z");

describe("confirmed changes — derived from dated, sourced records only", () => {
  test("demo debt changes come from posted transactions, pending excluded", () => {
    const changes = confirmedDebtChanges(demo());
    // Auto loan payment (loanPayment, principal $245.06) + card payment
    // (transfer into the credit card account, $500.00).
    expect(changes).toHaveLength(2);
    const auto = changes.find((c) => c.kind === "debtPrincipalPaid")!;
    expect(auto.date).toBe("2026-09-05");
    expect(auto.amountCents).toBe(24506);
    expect(auto.evidenceId).toBe("txn-auto-payment-0905");
    expect(auto.detail).toContain("principal");

    const card = changes.find((c) => c.kind === "debtBalanceReduced")!;
    expect(card.date).toBe("2026-09-09");
    expect(card.amountCents).toBe(50000);
    expect(card.title).toContain("Platinum Rewards Card");
    expect(card.evidenceId).toBe("txn-card-payment-credit-0909");
  });

  test("a pending loan payment is never presented as confirmed", () => {
    const h = demo();
    const withPending = {
      ...h,
      transactions: [
        ...h.transactions,
        {
          ...h.transactions.find((t) => t.id === "txn-auto-payment-0905")!,
          id: "txn-pending-pay",
          status: "pending" as const,
          postedAt: null,
          transactedAt: "2026-09-11",
        },
      ],
    };
    const changes = confirmedDebtChanges(withPending);
    expect(changes.find((c) => c.evidenceId === "txn-pending-pay")).toBeUndefined();
  });

  test("confirmed goal changes link to their evidence note", () => {
    const changes = confirmedGoalChanges(demo());
    expect(changes).toHaveLength(1);
    const c = changes[0];
    expect(c.kind).toBe("savingsContribution");
    expect(c.date).toBe("2026-09-02");
    expect(c.amountCents).toBe(20000);
    expect(c.title).toContain("Emergency fund");
    expect(c.detail).toContain("txn-savings-xfer-0902");
  });

  test("all confirmed changes are newest-first and distinct", () => {
    const all = allConfirmedChanges(demo());
    expect(all.map((c) => c.date)).toEqual([
      "2026-09-09",
      "2026-09-05",
      "2026-09-02",
    ]);
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
  });

  test("manual households have no confirmed changes — the honest empty state", () => {
    const inputs: ManualOnboardingInputs = {
      availableCents: 180000,
      payDate: "2026-10-01",
      netPayCents: 215384,
      obligations: [{ id: "ob-1", name: "Rent", amountCents: 90000, dueDay: 1 }],
      essentialsPerCycleCents: 20000,
      bufferCents: 30000,
      goal: null,
      giving: { choice: "skip", fixedCents: null, percentBps: null },
    };
    const h = manualHouseholdFor(inputs, "2026-09-12T10:00:00Z");
    expect(allConfirmedChanges(h)).toEqual([]);
  });
});

describe("check-in summary", () => {
  test("demo: nothing moved since the last received paycheck (Sep 10)", () => {
    const summary = checkInSummary(demo());
    expect(summary.changes).toEqual([]);
    expect(summary.windowLabel).toContain("2026-09-10");
    expect(summary.message).toContain("No confirmed changes yet");
  });

  test("a change after the last paycheck appears in the summary", () => {
    const h = demo();
    const withNew = {
      ...h,
      transactions: [
        ...h.transactions,
        {
          ...h.transactions.find((t) => t.id === "txn-auto-payment-0905")!,
          id: "txn-new-payment",
          transactedAt: "2026-09-15",
          postedAt: "2026-09-15",
        },
      ],
    };
    const summary = checkInSummary(withNew);
    expect(summary.changes).toHaveLength(1);
    expect(summary.changes[0].evidenceId).toBe("txn-new-payment");
    expect(summary.message).toContain("confirmed changes happened");
  });

  test("manual: no received paycheck, honest 'no confirmed changes yet'", () => {
    const inputs: ManualOnboardingInputs = {
      availableCents: 180000,
      payDate: "2026-10-01",
      netPayCents: 215384,
      obligations: [{ id: "ob-1", name: "Rent", amountCents: 90000, dueDay: 1 }],
      essentialsPerCycleCents: 20000,
      bufferCents: 30000,
      goal: null,
      giving: { choice: "skip", fixedCents: null, percentBps: null },
    };
    const summary = checkInSummary(
      manualHouseholdFor(inputs, "2026-09-12T10:00:00Z"),
    );
    expect(summary.changes).toEqual([]);
    expect(summary.message).toContain("No confirmed changes yet");
  });
});

describe("goal progress views — confirmed vs projected strictly separate", () => {
  test("emergency fund: dated confirmed history, projection labeled, never merged", () => {
    const views = goalProgressViews(demo());
    const emergency = views.find((v) => v.goal.goal.id === "goal-emergency")!;
    expect(emergency.goal.confirmedHistory).toHaveLength(1);
    expect(emergency.goal.confirmedTotalCents).toBe(20000);
    // Projected line item sits in its own channel with the next-paycheck date.
    expect(emergency.projected).toHaveLength(1);
    expect(emergency.projected[0].source).toBe("projected");
    expect(emergency.projected[0].confirmed).toBe(false);
    expect(emergency.projected[0].date).toBe("2026-09-25");
    expect(emergency.projected[0].amountCents).toBe(20000);
    // The current saved balance never mixes with projections.
    expect(emergency.goal.currentSavedCents).toBe(845000);
    // goals sorted by priority: emergency (1) before home repair (2).
    expect(views.map((v) => v.goal.goal.id)).toEqual([
      "goal-emergency",
      "goal-homerepair",
    ]);
  });

  test("home repair: no confirmed records, no projections — zero invention", () => {
    const repair = goalProgressViews(demo()).find(
      (v) => v.goal.goal.id === "goal-homerepair",
    )!;
    expect(repair.goal.confirmedHistory).toEqual([]);
    expect(repair.projected).toEqual([]);
    expect(repair.goal.percentCompleteBps).toBe(2500); // 125000/500000
  });
});