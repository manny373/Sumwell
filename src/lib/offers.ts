/**
 * Discover — labeled SYNTHETIC offers, Phase 3d.
 *
 * The spec is binding here:
 *   - Every offer is a clearly labeled synthetic sample, never a real offer.
 *   - Terms are stored as DATA (provider, product, APY/APR, fees, conditions,
 *     source URL, verification time, expiration, referral link), not invented
 *     at render time.
 *   - Expired terms are NEVER recommended: filtering is the only path into the
 *     UI, and the filter is unit-tested.
 *   - Rewards-led card promos are suppressed for households carrying revolving
 *     credit-card debt (the demo household has card debt — this rule must fire).
 *   - There is NO assumed approval and NO assumed credit limit anywhere; the
 *     type deliberately has no such fields (covered by a test).
 *   - "Keep your current account" and "No suitable offer right now" are
 *     first-class outcomes, built by the UI around this module's results.
 *
 * All dates are ISO strings; every comparison is pure string/date math via
 * `offerIsExpired` so behavior is deterministic and testable.
 */
import type { Household } from "./client/types";
import { formatBpsAsPercent } from "./money";

export type OfferKind = "creditCard" | "savings";

export interface DemoOffer {
  id: string;
  /** The (synthetic) institution offering the product. */
  provider: string;
  /** Short product name, e.g. "High-Yield Savings". */
  product: string;
  kind: OfferKind;
  /**
   * Rate in basis points: APY for savings, APR for credit cards.
   * bps 375 == 3.75%; 2049 == 20.49%. null = not published (never invented).
   */
  rateBps: number | null;
  /** Which rate the number above is: "APY" or "APR". */
  rateKind: "APY" | "APR";
  /** Plain-language fee note; null = no fee information (never invented). */
  feeNote: string | null;
  /** Plain-language conditions/eligibility note. */
  conditionNote: string;
  /**
   * True when the card's marketing is rewards-led. Such cards are suppressed
   * for households carrying revolving credit-card debt (spec: "suppress
   * rewards-led cards for people struggling with revolving debt").
   */
  rewardsProminent: boolean;
  /**
   * Source URL for the terms — stored as data per the spec. All null in
   * Milestone A: there are no real offer pages yet, and we never fabricate a
   * navigable URL.
   */
  sourceUrl: string | null;
  /** When these terms were verified (ISO date). */
  verifiedAt: string;
  /** When these terms expire (ISO date). Expired terms are never shown. */
  expiresAt: string;
  /** Referral link — stored as data; all null in the prototype (no real links). */
  referralLink: string | null;
}

/**
 * The full synthetic dataset. Deterministic constants — no Date.now(), no
 * Math.random(). Two entries are deliberately expired (dates before the
 * 2026-09-13 "today" the demo runs on) so the expiry filter has work to do and
 * is exercised by the UI and the unit tests.
 */
export const DEMO_OFFERS: readonly DemoOffer[] = [
  {
    id: "offer-savings-hy",
    provider: "Demo Credit Union",
    product: "High-Yield Savings",
    kind: "savings",
    rateBps: 375, // 3.75% APY
    rateKind: "APY",
    feeNote: "$0 monthly fee (sample)",
    conditionNote: "No minimum balance (sample terms).",
    rewardsProminent: false,
    sourceUrl: null,
    verifiedAt: "2026-09-10",
    expiresAt: "2026-10-10",
    referralLink: null,
  },
  {
    id: "offer-savings-mm",
    provider: "Demo National Bank",
    product: "Money Market",
    kind: "savings",
    rateBps: 325, // 3.25% APY
    rateKind: "APY",
    feeNote: "$0 monthly fee (sample)",
    conditionNote: "$500 minimum opening deposit (sample).",
    rewardsProminent: false,
    sourceUrl: null,
    verifiedAt: "2026-09-08",
    expiresAt: "2026-10-08",
    referralLink: null,
  },
  {
    id: "offer-card-rewards",
    provider: "Demo Rewards Bank",
    product: "Everyday Cash Back Card",
    kind: "creditCard",
    rateBps: 2049, // 20.49% APR
    rateKind: "APR",
    feeNote: "$0 annual fee (sample)",
    conditionNote: "Variable APR; sample terms only.",
    rewardsProminent: true,
    sourceUrl: null,
    verifiedAt: "2026-09-09",
    expiresAt: "2026-10-09",
    referralLink: null,
  },
  {
    id: "offer-card-simplicity",
    provider: "Demo Credit Union",
    product: "Simplicity Card",
    kind: "creditCard",
    rateBps: 2199, // 21.99% APR
    rateKind: "APR",
    feeNote: "$0 annual fee (sample)",
    conditionNote: "Variable APR; sample terms only.",
    rewardsProminent: false,
    sourceUrl: null,
    verifiedAt: "2026-09-05",
    expiresAt: "2026-10-31",
    referralLink: null,
  },
  // ---- expired: must never be recommended ----
  {
    id: "offer-savings-expired",
    provider: "Demo Credit Union",
    product: "Summit Savings",
    kind: "savings",
    rateBps: 350,
    rateKind: "APY",
    feeNote: "$0 monthly fee (sample)",
    conditionNote: "Sample terms only.",
    rewardsProminent: false,
    sourceUrl: null,
    verifiedAt: "2026-06-01",
    expiresAt: "2026-08-31",
    referralLink: null,
  },
  {
    id: "offer-card-expired-rewards",
    provider: "Demo Rewards Bank",
    product: "Cash Back Launch Card",
    kind: "creditCard",
    rateBps: 2499,
    rateKind: "APR",
    feeNote: "$0 annual fee (sample)",
    conditionNote: "Variable APR; sample terms only.",
    rewardsProminent: true,
    sourceUrl: null,
    verifiedAt: "2026-05-01",
    expiresAt: "2026-07-31",
    referralLink: null,
  },
];

/** Fixed UI wording — one source of truth so every card says the same thing. */
export const OFFER_DISCLAIMER = "Synthetic sample — not a real offer";
export const COMPENSATION_DISCLOSURE =
  "We may receive compensation if you open an account through this link — prototype wording. No real links exist here.";
export const NO_APPROVAL_NOTE =
  "No approval is assumed and no credit limit is shown — Sumwell never guesses whether you'd be approved.";

/** ISO-date comparison keeps expiry deterministic and locale-free. */
export function offerIsExpired(offer: DemoOffer, todayISO: string): boolean {
  return offer.expiresAt < todayISO;
}

/** True when the household carries revolving credit-card debt. */
export function hasRevolvingCardDebt(household: Household): boolean {
  return household.debts.some((d) => d.category === "creditCard");
}

export interface OffersForHousehold {
  /** The offers the UI may recommend: unexpired, suppression applied. */
  offers: DemoOffer[];
  /** How many dataset entries expired before `todayISO` (informational). */
  expiredCount: number;
  /** True when rewards-led cards were hidden because of card debt. */
  suppressedRewards: boolean;
  /** How many rewards-led cards are hidden by the suppression rule. */
  suppressedRewardsCount: number;
}

/**
 * The ONLY path offers reach the UI through. Filters expired terms, then
 * suppresses rewards-led credit cards for households with revolving card debt.
 * Pure and deterministic — callers pass today explicitly.
 */
export function offersForHousehold(
  household: Household,
  todayISO: string,
): OffersForHousehold {
  const unexpired = DEMO_OFFERS.filter((o) => !offerIsExpired(o, todayISO));
  const suppressedRewards = hasRevolvingCardDebt(household);
  const suppressedSet = new Set(
    suppressedRewards
      ? unexpired
          .filter((o) => o.kind === "creditCard" && o.rewardsProminent)
          .map((o) => o.id)
      : [],
  );
  return {
    offers: unexpired.filter((o) => !suppressedSet.has(o.id)),
    expiredCount: DEMO_OFFERS.length - unexpired.length,
    suppressedRewards,
    suppressedRewardsCount: suppressedSet.size,
  };
}

/** "3.75% APY" / "20.49% APR" / "Rate not published". */
export function formatOfferRate(offer: DemoOffer): string {
  if (offer.rateBps === null) return "Rate not published";
  // formatBpsAsPercent does exact integer math (bps 375 -> "3.75%", 1000 -> "10%").
  return `${formatBpsAsPercent(offer.rateBps)} ${offer.rateKind}`;
}