/**
 * Giving — conversions, impact, and labels (Phase 4a).
 *
 * One explicit model everywhere: a giving plan has a MODE (fixed or percent),
 * a FREQUENCY (weekly | biweekly | twiceMonthly | monthly), and a BASIS
 * (gross | net). Fixed-mode `amountCents` is denominated PER OCCURRENCE of the
 * frequency. Per-check and per-calendar-month amounts convert through ONE
 * canonical pair of functions that NEVER silently assumes two checks per
 * month:
 *
 *   - twiceMonthly  = 24 checks/yr  (2/mo exactly)
 *   - biweekly      = 26 checks/yr  (every 2 weeks ≈ 2.1667/mo)
 *
 * Adopted per-period policy (declared for the Sep 14 review):
 *   - Per-pay-period model: each paycheck reserves
 *         amount × occurrences-per-year(giving frequency)
 *        ─────────────────────────────────────────────────  rounded to the
 *              checks-per-year(pay frequency)
 *     nearest cent. For "monthly gift on twice-monthly pay" that is amount/2
 *     per check; for "monthly gift on biweekly pay" it is amount × 12/26 —
 *     the two cadences are never conflated.
 *   - Percent gifts are linear in the basis: each pay period reserves
 *     percent × that period's basis, so the share percentage is identical in
 *     the per-check and per-month contexts by construction.
 *   - Unsupported frequencies THROW (they are a closed union; the throw is a
 *     runtime guard). Households whose pay cadence isn't on record cannot
 *     resolve a FIXED gift to a per-check share: the caller receives a
 *     documented "pay cadence unknown" limitation instead of a silent guess.
 *
 * Impact arithmetic is always same-period: gift, basis, bills, and goals are
 * all cents for ONE named period (check | month), so "share of net pay" and
 * "share of bills + goals" compare like with like.
 */
import type { GivingFrequency, GivingPlan, Paycheck } from "./types";
import { bpsOfCents, formatBpsAsPercent, formatCents } from "../money";

export type { GivingFrequency } from "./types";

/** Occurrences per calendar year for each plan/pay cadence. */
export const OCCURRENCES_PER_YEAR: Record<GivingFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  twiceMonthly: 24,
  monthly: 12,
};

function checksPerYear(frequency: GivingFrequency): number {
  const value = OCCURRENCES_PER_YEAR[frequency as GivingFrequency];
  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `giving conversion: unsupported frequency "${String(frequency)}" — supported: weekly, biweekly, twiceMonthly, monthly`,
    );
  }
  return value;
}

/** Integer-safety guard so no float ever enters the money path. */
function guardCents(cents: number): number {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`giving conversion: expected integer cents, got ${String(cents)}`);
  }
  return cents;
}

/**
 * Per-month equivalent of a per-check amount for a given pay cadence.
 * perCheckToPeriod(6000, "twiceMonthly") = 12000; perCheckToPeriod(6000, "biweekly") = 13000.
 */
export function perCheckToPeriod(perCheckCents: number, payFrequency: GivingFrequency): number {
  const perCheck = guardCents(perCheckCents);
  const perYear = perCheck * checksPerYear(payFrequency);
  return Math.round(perYear / 12);
}

/**
 * Per-check equivalent of a per-month amount for a given pay cadence.
 * perMonthToPerCheck(12000, "twiceMonthly") = 6000; perMonthToPerCheck(12000, "biweekly") = 5538.
 */
export function perMonthToPerCheck(perMonthCents: number, payFrequency: GivingFrequency): number {
  const perMonth = guardCents(perMonthCents);
  const perYear = perMonth * 12;
  return Math.round(perYear / checksPerYear(payFrequency));
}

/**
 * The per-check share of a fixed amount at a giving cadence, on a household's
 * pay cadence: amount × givingOccurrencesPerYear ÷ checksPerYear, rounded to
 * the nearest cent. Never assumes two checks per month — 5538 (biweekly) and
 * 6000 (twice-monthly) are different answers for the same $120/month plan.
 */
export function perCheckShare(
  amountCents: number,
  givingFrequency: GivingFrequency,
  payFrequency: GivingFrequency,
): number {
  const amount = guardCents(amountCents);
  const perYear = amount * OCCURRENCES_PER_YEAR[givingFrequency];
  return Math.round(perYear / checksPerYear(payFrequency));
}

/** Human cadence word: "weekly" | "every 2 weeks" | "twice a month" | "monthly". */
export function frequencyWord(frequency: GivingFrequency): string {
  switch (frequency) {
    case "weekly":
      return "weekly";
    case "biweekly":
      return "every 2 weeks (biweekly)";
    case "twiceMonthly":
      return "twice a month";
    case "monthly":
      return "monthly";
  }
}

/** "Fixed — $120.00/month" / "Fixed — $60.00 every 2 weeks" — one label. */
export function fixedAmountNote(cents: number, frequency: GivingFrequency): string {
  const suffix =
    frequency === "monthly"
      ? "/month"
      : frequency === "weekly"
        ? "/week"
        : frequency === "twiceMonthly"
          ? " twice a month"
          : " every 2 weeks";
  return `Fixed — ${formatCents(cents)}${suffix}`;
}

/** The pay period named for a household cadence: "this pay period (twice a month)". */
export function payPeriodWord(payFrequency: GivingFrequency): string {
  return frequencyWord(payFrequency);
}

export interface GivingResolution {
  /** The per-check gift the pay period plan reserves; null when it can't be resolved. */
  givingCents: number | null;
  skipped: boolean;
  /** Null unless the gift is on but cannot be resolved to a per-check amount. */
  unresolved: string | null;
  /** Factual plain-language note — never tax or deduction advice. */
  note: string;
}

/**
 * Resolve the per-check gift from a giving plan for a household pay cadence.
 * - disabled plan → skipped.
 * - percent → bps of the per-check basis (linear; frequency affects cadence
 *   labels only and the percentage is period-invariant by construction).
 * - fixed + known pay cadence → perCheckShare (frequency-aware, never ÷2 by
 *   assumption).
 * - fixed + unknown pay cadence → the plan's own frequency is treated as the
 *   per-check cadence (documented limitation, never a silent division).
 */
export function givingForPeriod(
  plan: GivingPlan,
  paycheck: Pick<Paycheck, "grossCents" | "netCents">,
  payFrequency: GivingFrequency | null,
): GivingResolution {
  if (!plan.enabled) {
    return {
      givingCents: null,
      skipped: true,
      unresolved: null,
      note: "Giving plan is off for this period.",
    };
  }
  if (plan.mode === "percent") {
    const basisCents = plan.basis === "gross" ? paycheck.grossCents : paycheck.netCents;
    const givingCents = bpsOfCents(basisCents, plan.percentBps ?? 0);
    if (givingCents === 0) {
      return {
        givingCents: null,
        skipped: true,
        unresolved: null,
        note: "The giving plan is set to 0% for this period.",
      };
    }
    return {
      givingCents,
      skipped: false,
      unresolved: null,
      note: `Percent gift: ${formatBpsAsPercent(plan.percentBps ?? 0)} of ${plan.basis} income for this period.`,
    };
  }

  const amount = plan.amountCents;
  if (amount === null || amount === 0) {
    return {
      givingCents: null,
      skipped: true,
      unresolved: null,
      note: "No giving amount is set for this period.",
    };
  }
  if (payFrequency === null) {
    // The amount is per occurrence of the plan's own frequency; without a pay
    // cadence on record, that IS the per-check amount (documented limitation).
    return {
      givingCents: amount,
      skipped: false,
      unresolved: null,
      note: `Fixed gift of ${formatCents(amount)} per ${frequencyWord(plan.frequency)} — treated as per check because this household's pay cadence isn't on record.`,
    };
  }
  const givingCents = perCheckShare(amount, plan.frequency, payFrequency);
  return {
    givingCents,
    skipped: false,
    unresolved: null,
    note: `Fixed gift of ${formatCents(amount)} per ${frequencyWord(plan.frequency)} — ${formatCents(givingCents)} this pay period (${frequencyWord(payFrequency)} pay).`,
  };
}

export type ImpactPeriod = "check" | "month";

/** Same-period impact inputs — every amount is cents for ONE named period. */
export interface GivingImpactArgs {
  /** Gift for this period. */
  givingCents: number;
  /** Income basis (gross or net) for THIS SAME period. */
  basisCents: number;
  /** Bills for this period. */
  billsCents: number;
  /** Accepted goal commitments for this period. */
  goalsCents: number;
  period: ImpactPeriod;
}

export interface GivingImpactResult {
  givingCents: number;
  basisCents: number;
  /** Gift as a share of the basis, in bps (10000 = 100%). null when the basis is 0. */
  percentBps: number | null;
  billsCents: number;
  goalsCents: number;
  /** Gift as a share of bills + goals, in bps. null when the denominator is 0. */
  shareOfCommitmentsBps: number | null;
  period: ImpactPeriod;
  /** e.g. "net pay this pay period" — always names the period it uses. */
  basisLabel: string;
}

/**
 * Same-period impact: the share of net/gross and the share of bills+goals are
 * computed from amounts that all cover the SAME named period, so the
 * numerator and denominator can never drift apart (the Finding 1 mismatch).
 */
export function givingImpact(args: GivingImpactArgs): GivingImpactResult {
  const { givingCents, basisCents, billsCents, goalsCents, period } = args;
  const percentBps =
    basisCents > 0 && givingCents > 0
      ? Math.round((givingCents * 10000) / basisCents)
      : null;
  const denominator = billsCents + goalsCents;
  const shareOfCommitmentsBps =
    denominator > 0 && givingCents > 0
      ? Math.round((givingCents * 10000) / denominator)
      : null;
  const periodWord = period === "check" ? "this pay period" : "this month";
  return {
    givingCents,
    basisCents,
    percentBps,
    billsCents,
    goalsCents,
    shareOfCommitmentsBps,
    period,
    basisLabel: periodWord,
  };
}

export interface GivingPeriodInfo {
  /** Household pay cadence; null = not on record. */
  payFrequency: GivingFrequency | null;
  netCents: number;
  grossCents: number;
  /** Per-check gift already resolved (same source as the labels use). */
  givingCents: number | null;
}

/**
 * Single source of truth for giving labels — used by Setup, the Plan editor,
 * Home, and the Plan giving section so no context can drift.
 */
export function givingLabel(
  plan: GivingPlan,
  info: GivingPeriodInfo,
): {
  amountNote: string;
  frequencyNote: string;
  perCheckNote: string | null;
  shareOfNetNote: string | null;
} {
  const basisLabel = plan.basis === "gross" ? "gross pay" : "net pay";
  const frequencyNote = `${frequencyWord(plan.frequency)}${
    info.payFrequency === null ? " (pay cadence not on record)" : ""
  }`;
  const amountNote =
    plan.mode === "percent"
      ? `${formatBpsAsPercent(plan.percentBps ?? 0)} of ${basisLabel}`
      : fixedAmountNote(plan.amountCents ?? 0, plan.frequency);

  let perCheckNote: string | null = null;
  let shareOfNetNote: string | null = null;
  if (plan.mode === "percent") {
    perCheckNote = `${formatBpsAsPercent(plan.percentBps ?? 0)} of ${basisLabel} each pay period.`;
    const basis = plan.basis === "gross" ? info.grossCents : info.netCents;
    if (basis > 0 && info.givingCents !== null) {
      const bps = Math.round((info.givingCents * 10000) / basis);
      shareOfNetNote = `${formatBpsAsPercent(bps)} of ${basisLabel} this pay period (same-period percentage).`;
    }
  } else if (info.givingCents !== null) {
    perCheckNote =
      info.payFrequency === null
        ? `${formatCents(info.givingCents)} per check — this household's pay cadence isn't on record, so the plan's own frequency is treated as per check.`
        : `${formatCents(info.givingCents)} set aside per check (${frequencyWord(info.payFrequency)} pay).`;
    const basis = plan.basis === "gross" ? info.grossCents : info.netCents;
    if (basis > 0) {
      const bps = Math.round((info.givingCents * 10000) / basis);
      shareOfNetNote = `${formatBpsAsPercent(bps)} of ${basisLabel} this pay period (same-period percentage).`;
    }
  }

  return { amountNote, frequencyNote, perCheckNote, shareOfNetNote };
}