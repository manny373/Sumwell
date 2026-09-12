import { describe, expect, test } from "bun:test";
import type { GivingPlan, Paycheck } from "./types";
import { givingImpact } from "./giving";
import { createDemoSnapshot } from "./seed";

const plan = (over: Partial<GivingPlan>): GivingPlan => ({
  id: "giv",
  mode: "fixed",
  amountCents: 12000,
  percentBps: null,
  basis: "net",
  categories: ["charities"],
  schedule: "monthly",
  enabled: true,
  source: "demo",
  ...over,
});

const paycheck: Pick<Paycheck, "grossCents" | "netCents"> = {
  grossCents: 288462,
  netCents: 215384,
};

describe("givingImpact — factual effect on bills and goals", () => {
  test("fixed $120 gift: share of income and of bills+goals", () => {
    const result = givingImpact(
      plan({}),
      paycheck,
      { billsCents: 90000, goalsCents: 10000 },
    );
    expect(result.givingCents).toBe(12000);
    expect(result.basisCents).toBe(215384);
    expect(result.percentBps).toBe(557); // 120/2153.84 ≈ 5.57%
    expect(result.shareOfCommitmentsBps).toBe(1200); // 120/1000 = 12%
    expect(result.skipped).toBe(false);
  });

  test("percent plan applies to the chosen basis (net or gross)", () => {
    const net = givingImpact(
      plan({ mode: "percent", amountCents: null, percentBps: 1000 }),
      paycheck,
      { billsCents: 90000, goalsCents: 10000 },
    );
    // 10% of $2,153.84 net = $215.384 → $215.38
    expect(net.givingCents).toBe(21538);
    expect(net.basisCents).toBe(215384);
    expect(net.percentBps).toBe(1000);
    expect(net.shareOfCommitmentsBps).toBe(2154); // 215.38/1000 ≈ 21.54%

    const gross = givingImpact(
      plan({ mode: "percent", amountCents: null, percentBps: 1000, basis: "gross" }),
      paycheck,
      { billsCents: 90000, goalsCents: 10000 },
    );
    // 10% of $2,884.62 gross = $288.462 → $288.46
    expect(gross.givingCents).toBe(28846);
    expect(gross.basisCents).toBe(288462);
  });

  test("disabled or zero plans are skipped, never presented as a gift", () => {
    const off = givingImpact(
      plan({ enabled: false }),
      paycheck,
      { billsCents: 90000, goalsCents: 10000 },
    );
    expect(off.givingCents).toBe(0);
    expect(off.skipped).toBe(true);

    const zero = givingImpact(
      plan({ mode: "percent", amountCents: null, percentBps: 0 }),
      paycheck,
      { billsCents: 90000, goalsCents: 10000 },
    );
    expect(zero.givingCents).toBe(0);
    expect(zero.skipped).toBe(true);
  });

  test("notes never imply tax deductibility or app credit", () => {
    const result = givingImpact(
      plan({}),
      paycheck,
      { billsCents: 90000, goalsCents: 10000 },
    );
    expect(result.note.toLowerCase()).not.toContain("deduct");
    expect(result.note.toLowerCase()).not.toContain("tax");
  });

  test("seed giving plan is fixed — no preselected percentage", () => {
    const seed = createDemoSnapshot();
    expect(seed.givingPlan.mode).toBe("fixed");
    expect(seed.givingPlan.percentBps).toBeNull();
    expect(seed.givingPlan.amountCents).toBe(12000);
    const result = givingImpact(
      seed.givingPlan,
      { grossCents: 288462, netCents: 215384 },
      // Seed's monthly bill total (212120) plus a plausible goal allocation.
      { billsCents: 212120, goalsCents: 30000 },
    );
    expect(result.givingCents).toBe(12000);
  });
});