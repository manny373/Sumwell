/**
 * Credit module tests — the hard rules: a synthetic score exists ONLY inside
 * the labeled demo household, is never called FICO/VantageScore, and manual
 * households get no score at all.
 */
import { describe, expect, test } from "bun:test";
import { demoHousehold, manualHouseholdFor } from "./client/household";
import type { ManualOnboardingInputs } from "./client/types";
import {
  REAL_CREDIT_REQUIREMENTS,
  SYNTHETIC_SCORE_LABEL,
  SYNTHETIC_SCORE_NAME,
  syntheticCreditScore,
} from "./credit";

const manualInputs: ManualOnboardingInputs = {
  availableCents: 180000,
  payDate: "2026-10-01",
  netPayCents: 215384,
  obligations: [{ id: "ob-1", name: "Rent", amountCents: 90000, dueDay: 1 }],
  essentialsPerCycleCents: 20000,
  bufferCents: 30000,
  goal: null,
  giving: { choice: "skip", fixedCents: null, percentBps: null },
};

describe("syntheticCreditScore", () => {
  test("demo household gets a deterministic, clearly labeled synthetic score", () => {
    const household = demoHousehold();
    const first = syntheticCreditScore(household);
    const second = syntheticCreditScore(household);
    expect(first).toEqual(second); // deterministic
    expect(first).not.toBeNull();
    expect(first!.label).toBe("Synthetic demo score only");
    expect(first!.value).toBeGreaterThanOrEqual(first!.range[0]);
    expect(first!.value).toBeLessThanOrEqual(first!.range[1]);
    expect(first!.name).not.toMatch(/FICO|Vantage/i);
    expect(first!.note).toMatch(/not a FICO/i);
    expect(first!.note).toMatch(/VantageScore/i);
  });
  test("manual households get NO score — the unavailable state stays honest", () => {
    const manual = manualHouseholdFor(manualInputs, "2026-09-13T00:00:00Z");
    expect(syntheticCreditScore(manual)).toBeNull();
  });
  test("the score name is explained and distinct; label constant is binding", () => {
    expect(SYNTHETIC_SCORE_NAME).toBe("Sumwell demo score");
    expect(SYNTHETIC_SCORE_LABEL).toBe("Synthetic demo score only");
  });
});

describe("REAL_CREDIT_REQUIREMENTS", () => {
  test("states what a real score needs: provider + identity checks + authorization", () => {
    expect(REAL_CREDIT_REQUIREMENTS.length).toBeGreaterThanOrEqual(3);
    const joined = REAL_CREDIT_REQUIREMENTS.join(" ");
    expect(joined).toMatch(/approved credit-reporting provider/i);
    expect(joined).toMatch(/identity verification/i);
    expect(joined).not.toMatch(/approval odds|approval likelihood/i);
  });
});