import { describe, expect, test } from "bun:test";
import type { Obligation, Paycheck } from "./types";
import {
  forecastCashFlow,
  planForPaycheck,
  type AcceptedGoalContribution,
} from "./plan";

const paycheck: Paycheck = {
  id: "pc-0910",
  date: "2026-09-10",
  employer: "Demo Manufacturer",
  grossCents: 288462,
  netCents: 215384,
  received: true,
  accountId: null,
  source: "demo",
};

const ob = (id: string, name: string, amountCents: number, reflected = false): Obligation => ({
  id,
  name,
  amountCents,
  cadence: "monthly",
  dueDay: 1,
  category: "housing",
  essential: true,
  alreadyReflected: reflected,
  accountId: null,
  source: "demo",
});

/** All 30 days of September 2026, strictly increasing. */
function september2026(): string[] {
  const dates: string[] = [];
  for (let d = 1; d <= 30; d++) dates.push(`2026-09-${String(d).padStart(2, "0")}`);
  return dates;
}

describe("planForPaycheck — founder example and exactly-once deduction", () => {
  test("founder example: $1,800 − $900 − $200 − $150 − $300 = $250", () => {
    const goals: AcceptedGoalContribution[] = [
      { goalId: "goal-emergency", name: "Emergency fund", amountCents: 10000 },
    ];
    const result = planForPaycheck(
      paycheck,
      [ob("ob-rent", "Rent", 70000), ob("ob-ins", "Auto insurance", 20000)],
      20000, // essentials
      goals,
      5000, // giving
      30000, // buffer
      180000, // available
    );
    expect(result.remainingCents).toBe(25000);
    expect(result.isShortfall).toBe(false);
    expect(result.obligationsTotalCents).toBe(90000);
    expect(result.obligationsDeductedCents).toBe(90000);
    expect(result.obligationsReflectedCents).toBe(0);
    expect(result.essentialsCents).toBe(20000);
    expect(result.goalsCents).toBe(10000);
    expect(result.givingCents).toBe(5000);
    expect(result.bufferCents).toBe(30000);
    // 90000 + 20000 + 10000 + 5000 + 30000 = 155000
    expect(result.totalDeductedCents).toBe(155000);
  });

  test("every distinct commitment is deducted exactly once", () => {
    const result = planForPaycheck(
      paycheck,
      [ob("ob-a", "Rent", 55000), ob("ob-b", "Utilities", 20000), ob("ob-c", "Internet", 15000)],
      12000,
      [{ goalId: "g1", name: "Home repair fund", amountCents: 8000 }],
      4000,
      25000,
      175000,
    );
    // Deducted once: 3 obligations + essentials + 1 goal + giving + buffer = 7.
    expect(result.commitmentsDeductedCount).toBe(7);
    expect(result.obligationsDeductedCents).toBe(90000);
    expect(result.remainingCents).toBe(
      175000 - 90000 - 12000 - 8000 - 4000 - 25000,
    );
    expect(result.items.filter((i) => i.deducted).length).toBe(7);
  });

  test("pending transaction already inside available balance is not subtracted twice", () => {
    const result = planForPaycheck(
      paycheck,
      [ob("ob-pending", "Grocery (pending)", 20000, true)],
      15000,
      [{ goalId: "g1", name: "Emergency fund", amountCents: 5000 }],
      null,
      30000,
      100000,
    );
    expect(result.obligationsReflectedCents).toBe(20000);
    expect(result.obligationsDeductedCents).toBe(0);
    // 100000 − 0 − 15000 − 5000 − 0 − 30000 = 50000. A double-deduction would give 30000.
    expect(result.remainingCents).toBe(50000);
    expect(result.remainingCents).not.toBe(30000);
    const pending = result.items.find((i) => i.id === "ob-pending");
    expect(pending?.deducted).toBe(false);
  });

  test("shortfall is returned as an exact negative number, never rounded away", () => {
    const result = planForPaycheck(
      paycheck,
      [ob("ob-rent", "Rent", 70000), ob("ob-loan", "Auto loan", 50000)],
      50000,
      [{ goalId: "g1", name: "Emergency fund", amountCents: 10000 }],
      null,
      30000,
      150000,
    );
    expect(result.remainingCents).toBe(-60000);
    expect(result.isShortfall).toBe(true);
    expect(result.shortfallCents).toBe(60000);
  });
});

describe("forecastCashFlow — shortfall flags", () => {
  test("rent due before next paycheck leaves a negative day even though the month ends positive", () => {
    const forecast = forecastCashFlow(
      september2026(),
      [{ date: "2026-09-15", amountCents: 200000, estimated: true, label: "Paycheck (not yet received)" }],
      [{ date: "2026-09-01", amountCents: 140000, label: "Rent" }],
      30000,
    );
    expect(forecast.anyShortfall).toBe(true);
    // Balance is negative from Sep 1 through the start of Sep 15 (the day the
    // paycheck lands, which still begins negative) — all 15 days are flagged.
    expect(forecast.shortfallDays).toEqual(september2026().slice(0, 15));
    expect(forecast.endingBalanceCents).toBe(90000); // month ends positive
    expect(forecast.lowestBalanceCents).toBe(-110000);
    expect(forecast.days[0].belowZero).toBe(true);
    expect(forecast.days[15].belowZero).toBe(false);
    expect(forecast.incomeUncertain).toBe(true); // paycheck not received yet
  });

  test("month-end positive but mid-month day negative: every shortfall day is flagged", () => {
    const forecast = forecastCashFlow(
      september2026(),
      [
        { date: "2026-09-15", amountCents: 200000, estimated: false, label: "Paycheck (received)" },
        { date: "2026-09-25", amountCents: 200000, estimated: true, label: "Paycheck (expected)" },
      ],
      [
        { date: "2026-09-01", amountCents: 50000, label: "Rent" },
        { date: "2026-09-05", amountCents: 45000, label: "Groceries" },
        { date: "2026-09-10", amountCents: 8000, label: "Utilities" },
      ],
      10000,
    );
    // The account is below zero every day from Sep 1 up to and including the
// start of Sep 15 (paycheck day still begins negative) — every one of those
// days is flagged, even though the month ends positive.
    expect(forecast.shortfallDays).toEqual(september2026().slice(0, 15));
    expect(forecast.anyShortfall).toBe(true);
    expect(forecast.lowestBalanceCents).toBe(-93000);
    // Month ends positive: 10000 − 50000 − 45000 − 8000 + 200000 + 200000
    expect(forecast.endingBalanceCents).toBe(307000);
  });

  test("forecast income is marked estimated/uncertain until it is received", () => {
    const received = forecastCashFlow(
      september2026(),
      [{ date: "2026-09-15", amountCents: 200000, estimated: false }],
      [],
      0,
    );
    expect(received.incomeUncertain).toBe(false);

    const expected = forecastCashFlow(
      september2026(),
      [{ date: "2026-09-15", amountCents: 200000, estimated: true }],
      [],
      0,
    );
    expect(expected.incomeUncertain).toBe(true);
    expect(expected.days[14].inflowsEstimated).toBe(true);
  });

  test("rejects unsorted or empty date horizons", () => {
    expect(() => forecastCashFlow([], [], [], 0)).toThrow();
    expect(() =>
      forecastCashFlow(["2026-09-02", "2026-09-01"], [], [], 0),
    ).toThrow();
  });
});