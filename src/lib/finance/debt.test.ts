import { describe, expect, test } from "bun:test";
import type { Debt } from "./types";
import { addMonthsISO, debtComparison } from "./debt";
import { createDemoSnapshot } from "./seed";

const debt = (over: Partial<Debt>): Debt => ({
  id: "d",
  name: "Debt",
  category: "other",
  balanceCents: 10000,
  aprBps: null,
  aprKind: "unknown",
  minPaymentCents: 1000,
  minPaymentIsEstimate: false,
  // Explicitly unknown unless a test supplies a day — a missing due day must
  // never be treated as a due day.
  minPaymentDueDay: null,
  source: "demo",
  ...over,
});

describe("debtComparison — independently worked two-debt case", () => {
  // Hand-worked over 3 monthly cycles (interest accrues before payment;
  // minimums first, then the explicit extra budget cascades down strategy order):
  //   A: $100 balance, 24% APR (2400 bps), $25 min
  //   B: $50 balance, 12% APR (1200 bps), $15 min
  //   extra budget: $20/month → $60/month pool total.
  //
  // AVALANCHE (A first: 24% > 12%), in cents:
  //   M1: A 10000+200 → 10200−2500=7700−2000 extra=5700; B 5000+50 → 5050−1500=3550
  //   M2: A 5700+114 → 5814−2500=3314−2000 extra=1314;  B 3550+36 → 3586−1500=2086
  //   M3: A 1314+26 → 1340 paid; B 2086+21 → 2107−1500=607, extra pays 607 → done.
  //   Interest: A = 200+114+26 = 340¢; B = 50+36+21 = 107¢; total 447¢.
  //   Snowball (B first, smaller balance):
  //   Interest: B = 50+16 = 66¢; A = 200+154+68 = 422¢; total 488¢.
  const debts: Debt[] = [
    debt({ id: "A", name: "High-APR loan", balanceCents: 10000, aprBps: 2400, aprKind: "fixed", minPaymentCents: 2500 }),
    debt({ id: "B", name: "Low-APR loan", balanceCents: 5000, aprBps: 1200, aprKind: "fixed", minPaymentCents: 1500 }),
  ];

  test("avalanche pays less total interest than snowball on identical inputs", () => {
    const { avalanche, snowball } = debtComparison(debts, 2000, "2026-09-01");
    expect(avalanche.totalInterestCents).toBe(447);
    expect(snowball.totalInterestCents).toBe(488);
    expect(avalanche.totalInterestCents as number).toBeLessThan(
      snowball.totalInterestCents as number,
    );
  });

  test("avalanche payoff rows match the hand-worked schedule", () => {
    const { avalanche } = debtComparison(debts, 2000, "2026-09-01");
    const a = avalanche.payoffRows.find((r) => r.debtId === "A")!;
    const b = avalanche.payoffRows.find((r) => r.debtId === "B")!;
    expect(a.payoffMonth).toBe(3);
    expect(a.payoffDate).toBe("2026-12-01");
    expect(a.interestCents).toBe(340);
    expect(a.totalPaidCents).toBe(10340); // 10000 balance + 340 interest
    expect(b.payoffMonth).toBe(3);
    expect(b.interestCents).toBe(107);
    expect(b.totalPaidCents).toBe(5107);
    expect(avalanche.totalPaidCents).toBe(15447);
    expect(avalanche.lastPayoffDate).toBe("2026-12-01");
    expect(avalanche.truncated).toBe(false);
  });

  test("snowball pays the small balance first, then rolls its minimum into the big one", () => {
    const { snowball } = debtComparison(debts, 2000, "2026-09-01");
    const a = snowball.payoffRows.find((r) => r.debtId === "A")!;
    const b = snowball.payoffRows.find((r) => r.debtId === "B")!;
    expect(b.payoffMonth).toBe(2); // small balance first
    expect(b.payoffDate).toBe("2026-11-01");
    expect(b.interestCents).toBe(66);
    expect(b.totalPaidCents).toBe(5066);
    expect(a.payoffMonth).toBe(3);
    expect(a.interestCents).toBe(422);
    expect(a.totalPaidCents).toBe(10422);
    expect(snowball.totalPaidCents).toBe(15488);
  });
});

describe("debtComparison — unknown APR is never invented", () => {
  const debts: Debt[] = [
    debt({ id: "C", name: "Medical bill", balanceCents: 124000, aprBps: null, aprKind: "unknown", minPaymentCents: 5000 }),
    debt({ id: "D", name: "Card", balanceCents: 50000, aprBps: 500, aprKind: "fixed", minPaymentCents: 2000 }),
  ];

  test("unknown-APR debt reports null interest and a clearly-estimated payoff date", () => {
    const { avalanche, snowball } = debtComparison(debts, 0, "2026-09-01");
    for (const result of [avalanche, snowball]) {
      const medical = result.payoffRows.find((r) => r.debtId === "C")!;
      expect(medical.interestCents).toBeNull();
      expect(medical.interestIgnored).toBe(true);
      // $1,240 at $50/month with no interest → paid in month 25.
      expect(medical.payoffMonth).toBe(25);
      expect(medical.payoffDate).toBe("2028-10-01");
      expect(medical.payoffDateIsEstimate).toBe(true);
      // Aggregate interest is never presented as complete.
      expect(result.totalInterestCents).toBeNull();
      expect(result.interestComplete).toBe(false);
      expect(
        result.estimateNotes.some((n) => n.includes("unknown APR")),
      ).toBe(true);
    }
    // The known-APR debt still gets real (estimated) interest.
    const card = avalanche.payoffRows.find((r) => r.debtId === "D")!;
    expect(card.interestCents).not.toBeNull();
    expect(avalanche.totalInterestKnownCents).toBeGreaterThan(0);
  });
});

describe("debtComparison — fixed seed household", () => {
  test("avalanche still beats snowball on the full seed, all payoffs complete", () => {
    const seed = createDemoSnapshot();
    const { avalanche, snowball } = debtComparison(seed.debts, 25000, "2026-09-01");
    expect(avalanche.truncated).toBe(false);
    expect(snowball.truncated).toBe(false);
    // Medical bill has unknown APR → interest is incomplete, don't compare totals blindly.
    expect(avalanche.interestComplete).toBe(false);
    // Compare only the computed-interest portion: avalanche < snowball.
    expect(avalanche.totalInterestKnownCents).toBeLessThan(
      snowball.totalInterestKnownCents,
    );
    // Highest-APR debt (card) is retired first under avalanche.
    const cardAvalanche = avalanche.payoffRows.find((r) => r.debtId === "debt-card")!;
    const cardSnowball = snowball.payoffRows.find((r) => r.debtId === "debt-card")!;
    expect(cardAvalanche.payoffMonth).not.toBeNull();
    expect(cardSnowball.payoffMonth).not.toBeNull();
    expect(cardAvalanche.payoffMonth as number).toBeLessThan(
      cardSnowball.payoffMonth as number,
    );
    const medical = avalanche.payoffRows.find((r) => r.debtId === "debt-medical")!;
    expect(medical.interestCents).toBeNull();
    expect(medical.interestIgnored).toBe(true);
  });
});

describe("addMonthsISO", () => {
  test("clamps to the end of the month and carries years", () => {
    expect(addMonthsISO("2026-09-01", 3)).toBe("2026-12-01");
    expect(addMonthsISO("2026-09-01", 25)).toBe("2028-10-01");
    expect(addMonthsISO("2026-11-15", 2)).toBe("2027-01-15");
    expect(addMonthsISO("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonthsISO("2028-01-31", 1)).toBe("2028-02-29"); // leap year
  });
});

describe("payoff honesty — no positive-balance debt is labeled paid off", () => {
  test("a multi-year payoff lands in a later year with its month preserved", () => {
    // $1,240 at $50/mo with no interest → paid in month 25 (Sep 2026 + 25 = Oct 2028).
    const { avalanche } = debtComparison(
      [debt({ id: "M", name: "Medical", balanceCents: 124000, minPaymentCents: 5000 })],
      0,
      "2026-09-01",
    );
    const medical = avalanche.payoffRows.find((r) => r.debtId === "M")!;
    expect(medical.payoffMonth).toBe(25);
    expect(medical.payoffDate).toBe("2028-10-01");
    expect(medical.paidOff).toBe(true);
    // The payoff date is always strictly in the future — never "today".
    expect(medical.payoffDate! > "2026-09-01").toBe(true);
  });

  test("a debt beyond the modeled horizon keeps its balance and is NOT 'paid off'", () => {
    // A huge balance with a tiny minimum will never finish inside 600 months.
    const { avalanche } = debtComparison(
      [
        debt({
          id: "BIG",
          name: "Mortgage",
          balanceCents: 10000 * 10000, // $1,000,000
          aprBps: 500,
          aprKind: "fixed",
          minPaymentCents: 100,
        }),
      ],
      0,
      "2026-09-01",
    );
    const big = avalanche.payoffRows.find((r) => r.debtId === "BIG")!;
    expect(avalanche.truncated).toBe(true);
    expect(big.paidOff).toBe(false);
    expect(big.payoffMonth).toBeNull();
    expect(big.payoffDate).toBeNull();
    // The balance is still (positively) outstanding — the row never claims
    // completion, and its payoff label would say "beyond the modeled horizon".
    expect(big.totalPaidCents).toBeGreaterThan(0);
  });

  test("paidOff always matches payoffMonth in the seed comparison", () => {
    const seed = createDemoSnapshot();
    for (const strategy of [debtComparison(seed.debts, 25000, "2026-09-01").avalanche,
      debtComparison(seed.debts, 25000, "2026-09-01").snowball]) {
      for (const row of strategy.payoffRows) {
        expect(row.paidOff).toBe(row.payoffMonth !== null);
        if (row.payoffDate !== null) {
          // A labeled payoff is always projected into the future.
          expect(row.payoffDate > "2026-09-01").toBe(true);
        }
      }
    }
  });
});