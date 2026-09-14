import { describe, expect, test } from "bun:test";
import { demoHousehold, manualHouseholdFor } from "./household";
import {
  allConfirmedChanges,
  checkInSummary,
  confirmedDebtChanges,
  confirmedGoalChanges,
  evidenceRecordFor,
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

    const card = changes.find((c) => c.kind === "debtPaymentRecorded")!;
    expect(card.date).toBe("2026-09-09");
    expect(card.amountCents).toBe(50000);
    // "Payment recorded" — the RECORD, not an invented balance reduction.
    expect(card.title).toBe("Payment recorded");
    expect(card.detail).toContain("records the payment itself");
    expect(card.detail.toLowerCase()).not.toContain("reduced");
    expect(card.detail.toLowerCase()).not.toContain("saved");
    // Balance TODAY is stated as-is (the debt's own magnitude), never spun.
    expect(card.balanceTodayCents).toBe(328744);
    expect(card.balanceTodayAccountName).toBe("Platinum Rewards Card");
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
    // The detail is human copy naming the record by amount — no raw id.
    expect(c.detail).toContain("$200.00");
    expect(c.detail).toContain("transfer");
    expect(c.detail).not.toContain("txn-");
    expect(c.evidenceId).toBe("gc-emergency-0902");
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

  test("no change copy carries a raw internal record id", () => {
    for (const c of allConfirmedChanges(demo())) {
      expect(c.title).not.toMatch(/txn-|gc-|debt-/);
      expect(c.detail).not.toMatch(/txn-|gc-|debt-/);
      // The record id lives on the dedicated evidence/technical fields only.
      expect(c.evidenceId.length).toBeGreaterThan(0);
      expect(c.technicalId.length).toBeGreaterThan(0);
    }
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

describe("evidence model — evidenceId resolves to a real record", () => {
  test("every confirmed change resolves to its actual transaction or contribution", () => {
    const h = demo();
    const changes = allConfirmedChanges(h);
    expect(changes.length).toBeGreaterThan(0);
    for (const change of changes) {
      const record = evidenceRecordFor(h, change);
      expect(record).not.toBeNull();
      expect(record!.technicalId).toBe(change.evidenceId);
      // The heading is built from the REAL record, not from change copy.
      expect(record!.rows.length).toBeGreaterThan(0);
      expect(record!.rows.some((r) => r.label === "Amount")).toBe(true);
    }
  });

  test("a payment change resolves to the dated transaction that evidences it", () => {
    const h = demo();
    const card = confirmedDebtChanges(h).find(
      (c) => c.kind === "debtPaymentRecorded",
    )!;
    const record = evidenceRecordFor(h, card)!;
    expect(record.recordType).toBe("transaction");
    expect(record.heading).toContain("posted");
    const amountRow = record.rows.find((r) => r.label === "Amount")!;
    expect(amountRow.value).toContain("$500.00");
  });

  test("a deleted record resolves to NOT FOUND — nothing is invented", () => {
    const h = demo();
    const change = allConfirmedChanges(h)[0];
    const stripped = {
      ...h,
      transactions: h.transactions.filter((t) => t.id !== change.evidenceId),
      goalContributions: [],
    };
    expect(evidenceRecordFor(stripped, change)).toBeNull();
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