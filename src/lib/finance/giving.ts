/**
 * Giving impact — Phase 2.
 *
 * Optional giving: fixed amount or percent of gross/net income. The USER
 * chooses amount, timing, and priority — the product never preselects a
 * percentage, makes no religious assumptions, and never implies gifts are
 * tax-deductible. Impact is factual arithmetic: the gift amount, its share of
 * the income basis, and its size relative to bills and goal commitments.
 */
import type { GivingPlan, Paycheck } from "./types";
import { bpsOfCents, formatBpsAsPercent, formatCents } from "../money";

export interface GivingCommitments {
  /** Total bills for the period (e.g. the month). */
  billsCents: number;
  /** Total accepted goal contributions for the period. */
  goalsCents: number;
}

export interface GivingImpactResult {
  /** Gift amount for this period; 0 when the plan is off or unset. */
  givingCents: number;
  mode: "fixed" | "percent";
  /** What a percent gift applies to. */
  basis: "gross" | "net";
  /** The income amount used as the basis. */
  basisCents: number;
  /** Gift as a share of the basis, in bps (10000 = 100%). null when basis is 0. */
  percentBps: number | null;
  billsCents: number;
  goalsCents: number;
  /** Gift as a share of bills + goals, in bps. null when the denominator is 0. */
  shareOfCommitmentsBps: number | null;
  /** True when the plan is disabled or yields no gift this period. */
  skipped: boolean;
  /** Factual plain-language note — never tax or deduction advice. */
  note: string;
}

export function givingImpact(
  plan: GivingPlan,
  paycheck: Pick<Paycheck, "grossCents" | "netCents">,
  commitments: GivingCommitments,
): GivingImpactResult {
  if (
    plan.percentBps !== null &&
    (plan.percentBps < 0 || plan.percentBps > 10000)
  ) {
    throw new Error("givingImpact: percentBps must be between 0 and 10000");
  }

  const basisCents = plan.basis === "gross" ? paycheck.grossCents : paycheck.netCents;

  let givingCents = 0;
  let skipped = false;
  let note: string;

  if (!plan.enabled) {
    skipped = true;
    note = "Giving plan is off for this period.";
  } else if (plan.mode === "percent") {
    givingCents = bpsOfCents(basisCents, plan.percentBps ?? 0);
    if (givingCents === 0) {
      skipped = true;
      note = "The giving plan is set to 0% for this period.";
    } else {
      note = `Percent gift: ${formatBpsAsPercent(plan.percentBps ?? 0)} of ${plan.basis} income for this period.`;
    }
  } else {
    givingCents = plan.amountCents ?? 0;
    if (givingCents === 0) {
      skipped = true;
      note = "No giving amount is set for this period.";
    } else {
      note = `Fixed gift of ${formatCents(givingCents)} for this period.`;
    }
  }

  const percentBps =
    basisCents > 0 && givingCents > 0
      ? Math.round((givingCents * 10000) / basisCents)
      : null;

  const denominator = commitments.billsCents + commitments.goalsCents;
  const shareOfCommitmentsBps =
    denominator > 0 && givingCents > 0
      ? Math.round((givingCents * 10000) / denominator)
      : null;

  return {
    givingCents,
    mode: plan.mode,
    basis: plan.basis,
    basisCents,
    percentBps,
    billsCents: commitments.billsCents,
    goalsCents: commitments.goalsCents,
    shareOfCommitmentsBps,
    skipped,
    note,
  };
}