/**
 * Offers module tests — the expiry filter and the rewards-suppression rule are
 * the two hard requirements from the spec, so they get explicit coverage.
 * Expected values are hand-derived from the dataset, never asserted against
 * the implementation.
 */
import { describe, expect, test } from "bun:test";
import { demoHousehold, manualHouseholdFor } from "./client/household";
import type { ManualOnboardingInputs } from "./client/types";
import {
  DEMO_OFFERS,
  OFFER_DISCLAIMER,
  COMPENSATION_DISCLOSURE,
  formatOfferRate,
  hasRevolvingCardDebt,
  offerIsExpired,
  offersForHousehold,
} from "./offers";

const DEMO_TODAY = "2026-09-13"; // the sandbox clock the demo runs on
const EXPIRED_BEFORE_TODAY = [
  "offer-savings-expired", // expires 2026-08-31
  "offer-card-expired-rewards", // expires 2026-07-31
];
const REWARDS_CARD_ID = "offer-card-rewards"; // expired Oct 9, rewards-led

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

describe("dataset integrity", () => {
  test("every offer carries the full factual term fields the spec requires", () => {
    for (const offer of DEMO_OFFERS) {
      expect(offer.provider.length).toBeGreaterThan(0);
      expect(offer.product.length).toBeGreaterThan(0);
      expect(["creditCard", "savings"]).toContain(offer.kind);
      expect(["APY", "APR"]).toContain(offer.rateKind);
      expect(typeof offer.conditionNote).toBe("string");
      expect(typeof offer.verifiedAt).toBe("string");
      expect(typeof offer.expiresAt).toBe("string");
    }
  });
  test("ids are unique and verification always precedes expiration", () => {
    const ids = new Set<string>();
    for (const offer of DEMO_OFFERS) {
      expect(ids.has(offer.id)).toBe(false);
      ids.add(offer.id);
      expect(offer.verifiedAt <= offer.expiresAt).toBe(true);
    }
    expect(ids.size).toBe(DEMO_OFFERS.length);
  });
  test("NO assumed approval or credit limit exists on any offer", () => {
    for (const offer of DEMO_OFFERS) {
      const anyOffer = offer as unknown as Record<string, unknown>;
      expect("approvalOdds" in anyOffer).toBe(false);
      expect("approvalLikelihood" in anyOffer).toBe(false);
      expect("creditLimitCents" in anyOffer).toBe(false);
      expect("limitCents" in anyOffer).toBe(false);
    }
  });
  test("referral links and source URLs stay null in the prototype (no fake links)", () => {
    for (const offer of DEMO_OFFERS) {
      expect(offer.referralLink).toBeNull();
      expect(offer.sourceUrl).toBeNull();
    }
  });
});

describe("offerIsExpired", () => {
  test("an offer expires strictly before today is expired; same day is still valid", () => {
    const hy = DEMO_OFFERS.find((o) => o.id === "offer-savings-hy")!; // expires 10-10
    expect(offerIsExpired(hy, "2026-10-11")).toBe(true); // past expiry
    expect(offerIsExpired(hy, "2026-10-10")).toBe(false); // same day = still valid
    expect(offerIsExpired(hy, "2026-09-10")).toBe(false); // before expiry
  });
  test("the two deliberately expired entries are expired on demo today", () => {
    for (const id of EXPIRED_BEFORE_TODAY) {
      const offer = DEMO_OFFERS.find((o) => o.id === id);
      expect(offer).toBeDefined();
      expect(offerIsExpired(offer!, DEMO_TODAY)).toBe(true);
    }
  });
});

describe("offersForHousehold — expiry + suppression", () => {
  test("expired terms are NEVER recommended (not in any result)", () => {
    const { offers, expiredCount } = offersForHousehold(
      demoHousehold(),
      DEMO_TODAY,
    );
    for (const id of EXPIRED_BEFORE_TODAY) {
      expect(offers.some((o) => o.id === id)).toBe(false);
    }
    // Hand-derived: dataset of 6, exactly 2 expired on 2026-09-13.
    expect(expiredCount).toBe(2);
    expect(offers).toHaveLength(3);
  });

  test("demo household carries card debt → rewards-led card is suppressed", () => {
    expect(hasRevolvingCardDebt(demoHousehold())).toBe(true);
    const { offers, suppressedRewards, suppressedRewardsCount } =
      offersForHousehold(demoHousehold(), DEMO_TODAY);
    expect(suppressedRewards).toBe(true);
    expect(suppressedRewardsCount).toBe(1);
    expect(offers.some((o) => o.id === REWARDS_CARD_ID)).toBe(false);
    // The other (non-rewards) card sample and both savings samples remain.
    expect(offers.map((o) => o.id).sort()).toEqual(
      ["offer-card-simplicity", "offer-savings-hy", "offer-savings-mm"].sort(),
    );
  });

  test("household WITHOUT revolving card debt sees the rewards-led sample", () => {
    const manual = manualHouseholdFor(manualInputs, "2026-09-13T00:00:00Z");
    expect(hasRevolvingCardDebt(manual)).toBe(false);
    const { offers, suppressedRewards, suppressedRewardsCount } =
      offersForHousehold(manual, DEMO_TODAY);
    expect(suppressedRewards).toBe(false);
    expect(suppressedRewardsCount).toBe(0);
    expect(offers.some((o) => o.id === REWARDS_CARD_ID)).toBe(true);
  });

  test("when every term has expired the result is empty → 'no suitable offer'", () => {
    const { offers, expiredCount } = offersForHousehold(
      demoHousehold(),
      "2027-01-01",
    );
    expect(offers).toEqual([]);
    expect(expiredCount).toBe(DEMO_OFFERS.length);
  });
});

describe("fixed UI wording", () => {
  test("every card must carry both the sample and compensation disclosures", () => {
    expect(OFFER_DISCLAIMER).toBe("Synthetic sample — not a real offer");
    expect(COMPENSATION_DISCLOSURE).toContain(
      "We may receive compensation if you open an account through this link",
    );
  });
  test("rate formatting is exact and label-safe", () => {
    const hy = DEMO_OFFERS.find((o) => o.id === "offer-savings-hy")!;
    expect(formatOfferRate(hy)).toBe("3.75% APY");
    const card = DEMO_OFFERS.find((o) => o.id === "offer-card-simplicity")!;
    expect(formatOfferRate(card)).toBe("21.99% APR");
    expect(formatOfferRate({ ...hy, rateBps: null })).toBe(
      "Rate not published",
    );
  });
});