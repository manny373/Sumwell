/**
 * Credit — truthful unavailable state, Phase 3d.
 *
 * Rules from the spec:
 *   - Production credit monitoring needs an approved provider — NONE in
 *     Milestone A, so the real product is an honest unavailable state.
 *   - No fabrication OUTSIDE the labeled demo: a score is shown ONLY for
 *     `source: "demo"` households, is marked "Synthetic demo score only", and
 *     uses a distinct, explained name — never FICO or VantageScore.
 *   - Unknown approval likelihood stays unknown: no approval odds or limits
 *     anywhere in this module or the UI built on it.
 */
import type { Household } from "./client/types";

/** Distinct, explained score name — deliberately NOT "FICO" or "VantageScore". */
export const SYNTHETIC_SCORE_NAME = "Sumwell demo score";
/** Hard label every synthetic score card must carry. */
export const SYNTHETIC_SCORE_LABEL = "Synthetic demo score only";
export const SYNTHETIC_SCORE_FULL_NOTE =
  "This is a made-up number for the demo household only. It was not computed by a credit bureau, it is not a FICO\u00ae or VantageScore\u00ae, it is not connected to any real credit file, and it does not affect any real approval decision.";
/** Score range the synthetic model pretends to occupy. */
export const SYNTHETIC_SCORE_RANGE: readonly [number, number] = [300, 850];
/** When the demo's synthetic score was "as of" (fixed snapshot instant). */
export const SYNTHETIC_SCORE_AS_OF = "2026-09-10";

export interface SyntheticScore {
  /** Integer value inside [300, 850]. */
  value: number;
  name: string;
  label: string;
  range: readonly [number, number];
  asOf: string;
  note: string;
}

/**
 * The demo's static synthetic score. Deterministic by construction — it is
 * data, not a computation, and only exists for the labeled demo household.
 */
const DEMO_SYNTHETIC_SCORE: SyntheticScore = {
  value: 718,
  name: SYNTHETIC_SCORE_NAME,
  label: SYNTHETIC_SCORE_LABEL,
  range: SYNTHETIC_SCORE_RANGE,
  asOf: SYNTHETIC_SCORE_AS_OF,
  note: SYNTHETIC_SCORE_FULL_NOTE,
};

/**
 * Synthetic score for the labeled demo household; null for manual households.
 * Returning null is what makes the unavailable state honest — a user who
 * entered their own numbers gets NO score, ever.
 */
export function syntheticCreditScore(
  household: Household,
): SyntheticScore | null {
  return household.source === "demo" ? DEMO_SYNTHETIC_SCORE : null;
}

/** What a real score would require — shown on the Credit screen. */
export const REAL_CREDIT_REQUIREMENTS = [
  "An approved credit-reporting provider — Sumwell has none connected in this prototype.",
  "Your identity verification, with your explicit authorization.",
  "A real credit file to read — nothing here touches a bureau or pulls credit.",
] as const;

export const CREDIT_PROTOTYPE_NOTE =
  "No credit monitoring exists in this prototype. No provider is connected, no score is imported, and nothing here ever pulls your credit.";