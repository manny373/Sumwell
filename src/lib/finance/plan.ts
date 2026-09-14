/**
 * Paycheck planning and cash-flow forecasting — Phase 2.
 *
 * Deterministic, integer-cents math. A plan deducts each commitment EXACTLY
 * ONCE: obligations already reflected in the available balance are shown but
 * never deducted. A negative remaining amount is a shortfall and is returned
 * as a negative number — never rounded or clamped away.
 */
import type { CommitmentLedgerEntry, Obligation, Paycheck } from "./types";

/** A goal contribution the user has accepted for this paycheck period. */
export interface AcceptedGoalContribution {
  goalId: string;
  name: string;
  amountCents: number;
}

export interface PlanResult {
  paycheck: Paycheck;
  /** Eligible available funds at plan time (account-specific). */
  availableCents: number;
  /** All obligations passed in for the period. */
  obligationsTotalCents: number;
  /** Obligations this plan actually deducts (not already reflected). */
  obligationsDeductedCents: number;
  /** Obligations already inside the available balance — shown, not deducted. */
  obligationsReflectedCents: number;
  /** Debt minimums due INSIDE this period (each represented exactly once). */
  debtMinimumsCents: number;
  /** Adopted extra debt payment for this period (0 when nothing adopted). */
  debtExtraCents: number;
  essentialsCents: number;
  goalsCents: number;
  /** Amount given this period (0 when skipped). */
  givingCents: number;
  bufferCents: number;
  /** available − (deducted obligations + debt mins + adopted extra + essentials + goals + giving + buffer). */
  totalDeductedCents: number;
  /** NEGATIVE when shortfall — kept exact, never rounded away. */
  remainingCents: number;
  isShortfall: boolean;
  /** Positive magnitude of the shortfall; 0 when there is none. */
  shortfallCents: number;
  /** The commitment ledger for this plan. */
  items: CommitmentLedgerEntry[];
  /** Count of distinct commitments actually deducted (exactly-once audit). */
  commitmentsDeductedCount: number;
}

/**
 * A debt minimum payment due inside this paycheck window. Derived by the
 * cycle audit (each debt's minimum lands in exactly ONE window); the plan
 * deducts it exactly once and never subtracts every monthly minimum from
 * every paycheck.
 */
export interface DebtMinimumDeduction {
  debtId: string;
  name: string;
  /** Positive magnitude of the minimum payment. */
  amountCents: number;
  note?: string;
}

/**
 * remaining = available
 *           − obligations NOT already reflected in available
 *           − debt minimums due in-window (each exactly once)
 *           − adopted extra debt payment for this period
 *           − essentialsCents
 *           − accepted goals + giving
 *           − bufferCents
 *
 * Pending transactions that already sit inside `availableCents` are passed as
 * obligations with `alreadyReflected: true` and are never subtracted again.
 * Minimums already paid on record are NOT passed here — they are represented
 * by their dated transaction instead.
 */
export function planForPaycheck(
  paycheck: Paycheck,
  obligations: readonly Obligation[],
  essentialsCents: number,
  goals: readonly AcceptedGoalContribution[],
  givingCents: number | null,
  bufferCents: number,
  availableCents: number,
  debtMinimums: readonly DebtMinimumDeduction[] = [],
  debtExtraCents = 0,
): PlanResult {
  for (const amount of [essentialsCents, givingCents ?? 0, bufferCents, availableCents, debtExtraCents]) {
    if (!Number.isSafeInteger(amount)) {
      throw new Error("planForPaycheck: amounts must be integer cents");
    }
  }
  for (const d of debtMinimums) {
    if (!Number.isSafeInteger(d.amountCents)) {
      throw new Error("planForPaycheck: debt minimum amounts must be integer cents");
    }
  }

  const obligationsTotalCents = obligations.reduce((sum, o) => sum + o.amountCents, 0);
  const obligationsDeductedCents = obligations
    .filter((o) => !o.alreadyReflected)
    .reduce((sum, o) => sum + o.amountCents, 0);
  const obligationsReflectedCents = obligationsTotalCents - obligationsDeductedCents;

  const goalsCents = goals.reduce((sum, g) => sum + g.amountCents, 0);
  const giving = givingCents === null ? 0 : givingCents;

  const debtMinimumsCents = debtMinimums.reduce((sum, d) => sum + d.amountCents, 0);

  const totalDeductedCents =
    obligationsDeductedCents +
    debtMinimumsCents +
    debtExtraCents +
    essentialsCents +
    goalsCents +
    giving +
    bufferCents;

  const remainingCents = availableCents - totalDeductedCents;
  const isShortfall = remainingCents < 0;

  const items: CommitmentLedgerEntry[] = [
    ...obligations.map((o) => ({
      id: o.id,
      kind: "obligation" as const,
      name: o.name,
      amountCents: o.amountCents,
      deducted: !o.alreadyReflected,
      note: o.alreadyReflected
        ? "Already reflected in the available balance — not deducted again."
        : undefined,
    })),
    ...debtMinimums.map((d) => ({
      id: `debt-min-${d.debtId}`,
      kind: "debtMinimum" as const,
      name: d.name,
      amountCents: d.amountCents,
      deducted: true,
      note: d.note ?? "Minimum payment due inside this pay window — deducted exactly once.",
    })),
    ...(debtExtraCents > 0
      ? ([
          {
            id: "debt-extra",
            kind: "debtExtra" as const,
            name: "Adopted extra debt payment",
            amountCents: debtExtraCents,
            deducted: true,
            note: "Extra debt payment you adopted — committed for this period.",
          },
        ] as CommitmentLedgerEntry[])
      : []),
    {
      id: "essentials",
      kind: "essential" as const,
      name: "Essential spending (estimate)",
      amountCents: essentialsCents,
      deducted: true,
      note: "Estimated essential non-bill spending for this period.",
    },
    ...goals.map((g) => ({
      id: g.goalId,
      kind: "goal" as const,
      name: g.name,
      amountCents: g.amountCents,
      deducted: true,
      note: "Accepted goal contribution for this period.",
    })),
    ...(givingCents === null
      ? []
      : ([
          {
            id: "giving",
            kind: "giving" as const,
            name: "Giving (accepted for this period)",
            amountCents: giving,
            deducted: true,
            note: "Optional — chosen by the user for this period.",
          },
        ] as CommitmentLedgerEntry[])),
    {
      id: "buffer",
      kind: "buffer" as const,
      name: "Checking buffer",
      amountCents: bufferCents,
      deducted: true,
      note: "Your chosen buffer — money kept in checking, not spent.",
    },
  ];

  return {
    paycheck,
    availableCents,
    obligationsTotalCents,
    obligationsDeductedCents,
    obligationsReflectedCents,
    debtMinimumsCents,
    debtExtraCents,
    essentialsCents,
    goalsCents,
    givingCents: giving,
    bufferCents,
    totalDeductedCents,
    remainingCents,
    isShortfall,
    shortfallCents: isShortfall ? -remainingCents : 0,
    items,
    commitmentsDeductedCount: items.filter((i) => i.deducted).length,
  };
}

/** A forecast inflow (e.g. a paycheck). `estimated` = not yet received. */
export interface CashFlowInflow {
  date: string; // ISO date
  amountCents: number; // positive
  /** true until the money actually arrives — treated as uncertain/estimated. */
  estimated: boolean;
  label?: string;
}

export interface CashFlowOutflow {
  date: string; // ISO date
  amountCents: number; // positive
  label?: string;
}

export interface CashFlowDay {
  date: string;
  startingCents: number;
  inflowCents: number;
  outflowCents: number;
  endingCents: number;
  /** min(starting, ending) — pessimistic intraday low. */
  lowCents: number;
  belowZero: boolean;
  inflowsEstimated: boolean;
}

export interface CashFlowForecast {
  days: CashFlowDay[];
  startingBalanceCents: number;
  endingBalanceCents: number;
  lowestBalanceCents: number;
  /** Dates where the running balance dipped below zero — flagged even when the month ends positive. */
  shortfallDays: string[];
  anyShortfall: boolean;
  /** True when any inflow in the horizon is still estimated (not received). */
  incomeUncertain: boolean;
}

/**
 * Per-day running balance over a sorted, strictly increasing list of dates.
 * Every day below zero is flagged as a shortfall, even if the horizon ends
 * positive. Estimated (unreceived) inflows make `incomeUncertain` true.
 */
export function forecastCashFlow(
  dates: readonly string[],
  inflows: readonly CashFlowInflow[],
  outflows: readonly CashFlowOutflow[],
  startingBalanceCents = 0,
): CashFlowForecast {
  if (dates.length === 0) {
    throw new Error("forecastCashFlow: dates must not be empty");
  }
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] <= dates[i - 1]) {
      throw new Error(
        "forecastCashFlow: dates must be strictly increasing ISO dates",
      );
    }
  }

  const inflowByDate = new Map<string, { total: number; estimated: boolean }>();
  for (const ev of inflows) {
    const cur = inflowByDate.get(ev.date) ?? { total: 0, estimated: false };
    cur.total += ev.amountCents;
    cur.estimated = cur.estimated || ev.estimated;
    inflowByDate.set(ev.date, cur);
  }
  const outflowByDate = new Map<string, number>();
  for (const ev of outflows) {
    outflowByDate.set(ev.date, (outflowByDate.get(ev.date) ?? 0) + ev.amountCents);
  }

  let balance = startingBalanceCents;
  let lowest = startingBalanceCents;
  const days: CashFlowDay[] = [];
  const shortfallDays: string[] = [];
  let incomeUncertain = false;

  for (const date of dates) {
    const inflow = inflowByDate.get(date);
    const inflowCents = inflow?.total ?? 0;
    const outflowCents = outflowByDate.get(date) ?? 0;
    const starting = balance;
    balance = starting + inflowCents - outflowCents;
    const low = Math.min(starting, balance);
    if (low < 0) shortfallDays.push(date);
    if (low < lowest) lowest = low;
    if (inflow?.estimated) incomeUncertain = true;
    days.push({
      date,
      startingCents: starting,
      inflowCents,
      outflowCents,
      endingCents: balance,
      lowCents: low,
      belowZero: low < 0,
      inflowsEstimated: inflow?.estimated ?? false,
    });
  }

  return {
    days,
    startingBalanceCents,
    endingBalanceCents: balance,
    lowestBalanceCents: lowest,
    shortfallDays,
    anyShortfall: shortfallDays.length > 0,
    incomeUncertain,
  };
}