import { describe, expect, test } from "bun:test";
import type { GivingFrequency, GivingPlan, Paycheck } from "./types";
import {
  givingForPeriod,
  givingImpact,
  givingLabel,
  perCheckShare,
  perCheckToPeriod,
  perMonthToPerCheck,
} from "./giving";
import { createDemoSnapshot } from "./seed";

const plan = (over: Partial<GivingPlan>): GivingPlan => ({
  id: "giv",
  mode: "fixed",
  amountCents: 12000,
  percentBps: null,
  basis: "net",
  categories: ["charities"],
  frequency: "monthly",
  enabled: true,
  source: "demo",
  ...over,
});

const paycheck: Pick<Paycheck, "grossCents" | "netCents"> = {
  grossCents: 288462,
  netCents: 215384,
};

describe("giving conversions — weekly/biweekly/twiceMonthly/monthly", () => {
  test("perCheckToPeriod scales by the REAL occurrences per year (52/26/24/12)", () => {
    // $100/check → per month
    expect(perCheckToPeriod(10000, "weekly")).toBe(43333); // 100×52/12
    expect(perCheckToPeriod(10000, "biweekly")).toBe(21667); // 26 checks/yr
    expect(perCheckToPeriod(10000, "twiceMonthly")).toBe(20000); // 24 checks/yr
    expect(perCheckToPeriod(10000, "monthly")).toBe(10000);
    // biweekly (26) and twiceMonthly (24) are NEVER conflated.
    expect(perCheckToPeriod(10000, "biweekly")).not.toBe(
      perCheckToPeriod(10000, "twiceMonthly"),
    );
  });

  test("perMonthToPerCheck round-trips through the same occurrence tables", () => {
    // $120/month → per check
    expect(perMonthToPerCheck(12000, "weekly")).toBe(2769); // 120×12/52
    expect(perMonthToPerCheck(12000, "biweekly")).toBe(5538); // 120×12/26
    expect(perMonthToPerCheck(12000, "twiceMonthly")).toBe(6000); // 120×12/24
    expect(perMonthToPerCheck(12000, "monthly")).toBe(12000);
    // Round-trip: perCheckToPeriod(perMonthToPerCheck(x)) returns to x within
    // a cent per month (double rounding can cost a cent on weekly/biweekly).
    for (const f of ["weekly", "biweekly", "twiceMonthly", "monthly"] as GivingFrequency[]) {
      const back = perCheckToPeriod(perMonthToPerCheck(12000, f), f);
      expect(Math.abs(back - 12000)).toBeLessThanOrEqual(1);
      expect(Number.isSafeInteger(back)).toBe(true);
    }
  });

  test("no silent ÷2: monthly gift on biweekly pay ≠ monthly gift on twice-monthly pay", () => {
    // $120/month, per-pay-period policy: twiceMonthly pay reserves amount/2
    // (24 checks/yr); biweekly pay reserves amount×12/26 — the two cadences
    // resolve to DIFFERENT per-check amounts and neither is a blind "÷2".
    expect(perCheckShare(12000, "monthly", "twiceMonthly")).toBe(6000);
    expect(perCheckShare(12000, "monthly", "biweekly")).toBe(5538);
    expect(perCheckShare(12000, "monthly", "biweekly")).not.toBe(6000);
    expect(perCheckShare(12000, "monthly", "weekly")).toBe(2769);
    expect(perCheckShare(12000, "monthly", "monthly")).toBe(12000);
    // A per-check gift keeps its own cadence when converted between households.
    expect(perCheckShare(5000, "biweekly", "twiceMonthly")).toBe(5417); // 5000×26/24
    expect(perCheckShare(5000, "twiceMonthly", "biweekly")).toBe(4615); // 5000×24/26
    expect(perCheckShare(5000, "biweekly", "twiceMonthly")).not.toBe(
      perCheckShare(5000, "twiceMonthly", "biweekly"),
    );
  });

  test("rounding stays in integer cents (no floats on the money path)", () => {
    expect(perCheckShare(333, "monthly", "weekly")).toBe(Math.round((333 * 12) / 52));
    // A pathological amount still returns a safe integer.
    expect(Number.isSafeInteger(perCheckShare(333, "monthly", "weekly"))).toBe(true);
  });

  test("unsupported frequencies throw — a closed union, not a silent default", () => {
    expect(() =>
      givingForPeriod(
        { ...plan({ frequency: "fortnightly" as GivingFrequency }) },
        paycheck,
        "biweekly",
      ),
    ).toThrow();
  });
});

describe("givingForPeriod — resolve the per-check gift", () => {
  test("fixed monthly $120 on twice-monthly pay → $60 per check", () => {
    const r = givingForPeriod(plan({}), paycheck, "twiceMonthly");
    expect(r.givingCents).toBe(6000);
    expect(r.skipped).toBe(false);
    expect(r.unresolved).toBeNull();
    expect(r.note).toContain("$60.00");
    expect(r.note).toContain("twice a month");
  });

  test("fixed gift with unknown pay cadence is treated as the plan's own cadence (documented limitation)", () => {
    const r = givingForPeriod(plan({}), paycheck, null);
    expect(r.givingCents).toBe(12000);
    expect(r.skipped).toBe(false);
    expect(r.note).toContain("pay cadence isn't on record");
    // Never a silent guess: the note names the limitation.
    expect(r.note).not.toContain("twice a month pay");
  });

  test("percent plan applies to the chosen basis (net or gross)", () => {
    const net = givingForPeriod(
      plan({ mode: "percent", amountCents: null, percentBps: 1000 }),
      paycheck,
      "twiceMonthly",
    );
    // 10% of $2,153.84 net = $215.384 → $215.38
    expect(net.givingCents).toBe(21538);
    expect(net.skipped).toBe(false);
    expect(net.note).toContain("10%");

    const gross = givingForPeriod(
      plan({ mode: "percent", amountCents: null, percentBps: 1000, basis: "gross" }),
      paycheck,
      "twiceMonthly",
    );
    // 10% of $2,884.62 gross = $288.462 → $288.46
    expect(gross.givingCents).toBe(28846);
  });

  test("disabled or zero plans are skipped, never presented as a gift", () => {
    const off = givingForPeriod(plan({ enabled: false }), paycheck, "twiceMonthly");
    expect(off.givingCents).toBeNull();
    expect(off.skipped).toBe(true);
    expect(off.note).toContain("off");

    const zero = givingForPeriod(
      plan({ mode: "percent", amountCents: null, percentBps: 0 }),
      paycheck,
      "twiceMonthly",
    );
    expect(zero.givingCents).toBeNull();
    expect(zero.skipped).toBe(true);
    expect(zero.note).toContain("0%");

    const noAmount = givingForPeriod(plan({ amountCents: 0 }), paycheck, "twiceMonthly");
    expect(noAmount.givingCents).toBeNull();
    expect(noAmount.skipped).toBe(true);
  });

  test("notes never imply tax deductibility or app credit", () => {
    for (const freq of [null, "twiceMonthly"] as (GivingFrequency | null)[]) {
      const r = givingForPeriod(plan({}), paycheck, freq);
      expect(r.note.toLowerCase()).not.toContain("deduct");
      expect(r.note.toLowerCase()).not.toContain("tax");
    }
  });
});

describe("givingImpact — same-period factual effect on bills and goals", () => {
  test("check-period impact: gift, basis, bills, goals all cover the same check", () => {
    const result = givingImpact({
      givingCents: 6000,
      basisCents: 215384,
      billsCents: 35870,
      goalsCents: 20000,
      period: "check",
    });
    expect(result.givingCents).toBe(6000);
    expect(result.basisCents).toBe(215384);
    expect(result.percentBps).toBe(279); // 60/2153.84 ≈ 2.79% — of THIS check
    expect(result.shareOfCommitmentsBps).toBe(1074); // 60/(358.70+200) ≈ 10.74%
    expect(result.basisLabel).toBe("this pay period");
    expect(result.period).toBe("check");
  });

  test("same-period invariant: scaling both sides keeps the percentages IDENTICAL (no 5.57% drift)", () => {
    // One check: $60 gift over $2,153.84 net and $558.70 commitments.
    const check = givingImpact({
      givingCents: 6000,
      basisCents: 215384,
      billsCents: 35870,
      goalsCents: 20000,
      period: "check",
    });
    // One month (two identical checks): $120 gift over $4,307.68 net and
    // $1,117.40 commitments. Numerator and denominator scale TOGETHER, so the
    // shares must be equal — the old mixed-period math (557 vs 279) is gone.
    const month = givingImpact({
      givingCents: 12000,
      basisCents: 430768,
      billsCents: 71740,
      goalsCents: 40000,
      period: "month",
    });
    expect(check.percentBps).toBe(month.percentBps); // 279 === 279
    expect(check.shareOfCommitmentsBps).toBe(month.shareOfCommitmentsBps); // 1074 === 1074
    expect(month.period).toBe("month");
    expect(month.basisLabel).toBe("this month");
  });

  test("zero basis or zero commitments yield null shares, never division-by-zero", () => {
    const noBasis = givingImpact({
      givingCents: 6000,
      basisCents: 0,
      billsCents: 35870,
      goalsCents: 20000,
      period: "check",
    });
    expect(noBasis.percentBps).toBeNull();
    const noCommitments = givingImpact({
      givingCents: 6000,
      basisCents: 215384,
      billsCents: 0,
      goalsCents: 0,
      period: "check",
    });
    expect(noCommitments.shareOfCommitmentsBps).toBeNull();
  });
});

describe("givingLabel — one label source (Setup/editor/Home/Plan/preview)", () => {
  test("fixed plan: amount, frequency, per-check and same-period share notes", () => {
    const label = givingLabel(plan({}), {
      payFrequency: "twiceMonthly",
      netCents: 215384,
      grossCents: 288462,
      givingCents: 6000,
    });
    expect(label.amountNote).toBe("Fixed — $120.00/month");
    expect(label.frequencyNote).toBe("monthly");
    expect(label.perCheckNote).toBe("$60.00 set aside per check (twice a month pay).");
    expect(label.shareOfNetNote).toContain("2.79%");
    expect(label.shareOfNetNote).toContain("same-period percentage");
  });

  test("biweekly pay renders a DIFFERENT per-check note than twice-monthly", () => {
    const biweekly = givingLabel(plan({}), {
      payFrequency: "biweekly",
      netCents: 215384,
      grossCents: 288462,
      givingCents: 5538,
    });
    const twice = givingLabel(plan({}), {
      payFrequency: "twiceMonthly",
      netCents: 215384,
      grossCents: 288462,
      givingCents: 6000,
    });
    expect(biweekly.perCheckNote).toContain("$55.38");
    expect(twice.perCheckNote).toContain("$60.00");
    expect(biweekly.perCheckNote).not.toBe(twice.perCheckNote);
  });

  test("percent plan: amount note names the basis, per-check note is percentage-based", () => {
    const label = givingLabel(
      plan({ mode: "percent", amountCents: null, percentBps: 1000 }),
      {
        payFrequency: "twiceMonthly",
        netCents: 215384,
        grossCents: 288462,
        givingCents: 21538,
      },
    );
    expect(label.amountNote).toBe("10% of net pay");
    expect(label.frequencyNote).toBe("monthly");
    expect(label.perCheckNote).toBe("10% of net pay each pay period.");
  });

  test("unknown pay cadence is named in the label, never hidden", () => {
    const label = givingLabel(plan({}), {
      payFrequency: null,
      netCents: 215384,
      grossCents: 288462,
      givingCents: 12000,
    });
    expect(label.frequencyNote).toContain("pay cadence not on record");
    expect(label.perCheckNote).toContain("isn't on record");
  });
});

describe("seed giving plan", () => {
  test("seed giving plan is fixed — no preselected percentage, monthly cadence", () => {
    const seed = createDemoSnapshot();
    expect(seed.givingPlan.mode).toBe("fixed");
    expect(seed.givingPlan.percentBps).toBeNull();
    expect(seed.givingPlan.amountCents).toBe(12000);
    expect(seed.givingPlan.frequency).toBe("monthly");
    // The demo pays twice a month (10th & 25th): per-check share = $60,
    // resolved through the frequency-aware conversion, never ÷2 by assumption.
    expect(givingForPeriod(seed.givingPlan, paycheck, "twiceMonthly").givingCents).toBe(6000);
  });
});