/**
 * Plan screen view builders — Phase 3b + Phase 4a fixes.
 *
 * Pure, deterministic functions that turn a Household into everything the Plan
 * tab renders: the cycle's bills (exactly-once semantics), the debt strategy
 * WHAT-IF comparison clearly separated from the ADOPTED extra payment, the
 * debt-minimum audit for this cycle, savings goals with confirmed-vs-projected
 * progress, the optional giving plan with same-period factual impact and one
 * label source, and simulated automation rules whose previews resolve their
 * trigger dates through the SPECIFIC linked obligation/debt (never a
 * substitute bill). Nothing here moves money, invents amounts, or implies a
 * transfer happened.
 */
import { debtComparison } from "~/lib/finance/debt";
import { goalProgress } from "~/lib/finance/goals";
import {
  givingForPeriod,
  givingImpact,
  givingLabel,
  perMonthToPerCheck,
  frequencyWord,
  type GivingFrequency,
} from "~/lib/finance/giving";
import {
  forecastCashFlow,
  type CashFlowDay,
  type CashFlowForecast,
} from "~/lib/finance/plan";
import { bpsOfCents, formatCents } from "~/lib/money";
import type {
  Account,
  AutomationRule,
  Debt,
  GivingPlan,
  GoalContribution,
  Obligation,
  Paycheck,
} from "~/lib/finance/types";
import type { Household } from "./types";
import {
  cycleObligations,
  cycleDebtMinimums,
  debtMinimumAudit,
  eligibleAvailableCents,
  givingForCycle,
  lastReceivedPaycheck,
  payFrequencyFor,
  nextPaycheck,
} from "./plan";
import {
  householdGoalContributions,
  debtExtraBudgetFor,
  adoptedDebtExtraFor,
} from "./household";
import {
  addDays,
  daysBetween,
  formatMonthDay,
  formatWeekdayMonthDay,
  nextMonthlyOccurrence,
} from "./dates";

/* ---------------------------------------------------- 1. bills & cycle -- */

export interface CycleObligationsView {
  obligations: Obligation[];
  totalCents: number;
  /** Obligations this plan deducts (not already reflected). */
  deductedCents: number;
  /** Already inside the available balance — shown, never deducted again. */
  reflectedCents: number;
  reflectedCount: number;
  /** Window anchors: last received paycheck → next paycheck (or null). */
  windowStart: string | null;
  windowEnd: string | null;
}

export function cycleObligationsView(household: Household): CycleObligationsView {
  const obligations = cycleObligations(household);
  const lastReceived = lastReceivedPaycheck(household);
  const next = nextPaycheck(household);
  const reflected = obligations.filter((o) => o.alreadyReflected);
  return {
    obligations,
    totalCents: obligations.reduce((s, o) => s + o.amountCents, 0),
    deductedCents: obligations
      .filter((o) => !o.alreadyReflected)
      .reduce((s, o) => s + o.amountCents, 0),
    reflectedCents: reflected.reduce((s, o) => s + o.amountCents, 0),
    reflectedCount: reflected.length,
    windowStart: lastReceived?.date ?? null,
    windowEnd: next?.date ?? null,
  };
}

/* --------------------------------------- 1b. cycle debt minimum audit --- */

export interface CycleDebtMinimumsView {
  /** The full audit (each debt exactly one bucket). */
  audit: ReturnType<typeof debtMinimumAudit>;
  /** Minimums deducted by THIS cycle's plan, in cents. */
  inWindowCents: number;
  paidOnRecordCount: number;
  afterWindowCount: number;
  noDueDateCount: number;
}

/** The Plan section's "minimum payments this cycle" view — built from the audit. */
export function cycleDebtMinimumsView(household: Household): CycleDebtMinimumsView {
  const audit = debtMinimumAudit(household);
  return {
    audit,
    inWindowCents: audit
      .filter((r) => r.status === "inWindow")
      .reduce((s, r) => s + r.debt.minPaymentCents, 0),
    paidOnRecordCount: audit.filter((r) => r.status === "paidOnRecord").length,
    afterWindowCount: audit.filter((r) => r.status === "afterWindow").length,
    noDueDateCount: audit.filter((r) => r.status === "noDueDate").length,
  };
}

/* ------------------------------------------------------ 2. debt plans --- */

export interface FundingGapInfo {
  /** Extra per-check (what-if monthly ÷ pay cadence). */
  extraPerCheckCents: number;
  /** In-window minimums for this cycle. */
  minimumsPerCycleCents: number;
  /** What's left this cycle after bills, essentials, buffer, goals, giving. */
  availableForDebtCents: number;
  /** Positive when the what-if scenario would outrun available funds. */
  gapCents: number;
  /** Null when the pay cadence isn't on record (gap can't be computed). */
  computed: boolean;
}

export interface DebtStrategyView {
  /** The two side-by-side strategies from the engine (WHAT-IF, not adopted). */
  comparison: ReturnType<typeof debtComparison>;
  /** The editable what-if extra budget (monthly) — never adopted implicitly. */
  extraBudgetCents: number;
  /** Sum of all statement minimums (monthly). */
  minimumsCents: number;
  /** minimums + what-if extra — the MONTHLY what-if cash number. */
  monthlyTotalCents: number;
  /** The ADOPTED extra payment (monthly) — flows into Home each period. */
  adoptedExtraCents: number;
  /** Per-check adopted amount for the current cycle (0 when none). */
  adoptedPerCheckCents: number;
  /** What-if funding gap vs this cycle's available-after-plan money. */
  gap: FundingGapInfo;
  /** True when the what-if extra equals the adopted amount. */
  whatIfMatchesAdopted: boolean;
  /** True when the pay cadence isn't on record (adoption/../math limited). */
  payCadenceKnown: boolean;
}

export function debtStrategyView(
  household: Household,
  nowISO: string,
): DebtStrategyView {
  const extraBudgetCents = debtExtraBudgetFor(household);
  const adoptedExtraCents = adoptedDebtExtraFor(household);
  const comparison = debtComparison(household.debts, extraBudgetCents, nowISO);
  const minimumsCents = household.debts.reduce((s, d) => s + d.minPaymentCents, 0);
  const payFrequency = payFrequencyFor(household);
  const payCadenceKnown = payFrequency !== null;

  // Per-cycle funding: what's left after the plan's fixed commitments,
  // before any debt minimums or extra payments.
  const next = nextPaycheck(household);
  const availableCents = next ? eligibleAvailableCents(household, next) : null;
  const billTotal = cycleObligations(household).reduce(
    (s, o) => s + (o.alreadyReflected ? 0 : o.amountCents),
    0,
  );
  const givingCents =
    next === null
      ? 0
      : (givingForCycle(
          household.givingPlan,
          payFrequency,
          next.netCents,
          next.grossCents,
        ) ?? 0);
  const goalsCents = household.assumptions.goalContributions.reduce(
    (s, g) => s + g.amountCents,
    0,
  );
  const availableForDebtCents =
    availableCents === null
      ? 0
      : availableCents -
        billTotal -
        household.assumptions.essentialsPerCycleCents -
        household.assumptions.bufferCents -
        goalsCents -
        givingCents;

  const minimumsPerCycleCents = cycleDebtMinimums(household).reduce(
    (s, d) => s + d.amountCents,
    0,
  );
  let gap: FundingGapInfo;
  if (payFrequency === null) {
    gap = {
      extraPerCheckCents: 0,
      minimumsPerCycleCents,
      availableForDebtCents,
      gapCents: 0,
      computed: false,
    };
  } else {
    const extraPerCheckCents = perMonthToPerCheck(extraBudgetCents, payFrequency);
    gap = {
      extraPerCheckCents,
      minimumsPerCycleCents,
      availableForDebtCents,
      gapCents: Math.max(
        0,
        extraPerCheckCents + minimumsPerCycleCents - availableForDebtCents,
      ),
      computed: true,
    };
  }

  const adoptedPerCheckCents =
    payFrequency === null ? 0 : perMonthToPerCheck(adoptedExtraCents, payFrequency);

  return {
    comparison,
    extraBudgetCents,
    minimumsCents,
    monthlyTotalCents: minimumsCents + extraBudgetCents,
    adoptedExtraCents,
    adoptedPerCheckCents,
    gap,
    whatIfMatchesAdopted: extraBudgetCents === adoptedExtraCents,
    payCadenceKnown,
  };
}

const FEDERAL_STUDENT = "Federal student loans";
const PRIVATE_STUDENT = "Private student loans";
const OTHER_DEBTS = "Other debts";

/** Federal vs private student loans are kept visually separate, always. */
export function debtGroupName(debt: {
  category: string;
  name: string;
}): string {
  if (debt.category !== "studentLoan") return OTHER_DEBTS;
  return /federal/i.test(debt.name) ? FEDERAL_STUDENT : PRIVATE_STUDENT;
}

export const DEBT_GROUP_ORDER = [
  FEDERAL_STUDENT,
  PRIVATE_STUDENT,
  OTHER_DEBTS,
] as const;

/* ------------------------------------------------------- 3. goals ------- */

/** Projected line items derived from the accepted allocations — never merged
 *  into confirmed history. Date = the next paycheck (the plan's "if you follow
 *  this plan" horizon). */
export function projectedGoalContributions(
  household: Household,
): GoalContribution[] {
  const next = nextPaycheck(household);
  if (!next) return [];
  return household.assumptions.goalContributions.map((g) => ({
    id: `proj-${g.goalId}-${next.date}`,
    goalId: g.goalId,
    amountCents: g.amountCents,
    date: next.date,
    source: "projected" as const,
    confirmed: false,
    note: "Accepted allocation for the current cycle — not saved yet.",
  }));
}

export interface GoalView {
  /** The goal's progress result (carries `.goal` — the Goal entity). */
  goal: ReturnType<typeof goalProgress>;
  /** Accepted allocation for this cycle (assumptions), in cents. */
  acceptedCents: number;
}

export function goalViews(household: Household): GoalView[] {
  const all = [
    ...householdGoalContributions(household),
    ...projectedGoalContributions(household),
  ];
  const goals = household.goals
    .slice()
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  return goals.map((goal) => ({
    goal: goalProgress(goal, all, false),
    acceptedCents:
      household.assumptions.goalContributions.find(
        (g) => g.goalId === goal.id,
      )?.amountCents ?? 0,
  }));
}

/* ------------------------------------------------------- 4. giving ------ */

export interface GivingView {
  plan: GivingPlan;
  /** The per-check amount the Home plan deducts; null = skipped/unresolved. */
  cycleGivingCents: number | null;
  /** True when the plan is off or yields no gift this period. */
  skipped: boolean;
  /** When the plan is on but can't resolve a per-check amount, explain why. */
  resolutionNote: string | null;
  /** Same-period impact (per-check context — all amounts are this check's). */
  impact: ReturnType<typeof givingImpact> | null;
  /** Single label source shared with Setup/Home/editor (Finding 1). */
  label: ReturnType<typeof givingLabel>;
  /** "This pay period" (the row label for the per-check amount). */
  periodRowLabel: string;
  /** Per-check bills behind the impact share. */
  billsCycleCents: number;
  /** Per-check goal allocations behind the impact share. */
  goalsCycleCents: number;
}

export function givingView(household: Household): GivingView {
  const plan = household.givingPlan;
  const paycheck = nextPaycheck(household);
  const payFrequency = payFrequencyFor(household);

  const resolution =
    paycheck === null
      ? null
      : givingForPeriod(
          plan,
          { netCents: paycheck.netCents, grossCents: paycheck.grossCents },
          payFrequency,
        );
  const cycleGivingCents =
    resolution === null || resolution.skipped || resolution.givingCents === null
      ? null
      : resolution.givingCents;

  const billsCycleCents = cycleObligations(household).reduce(
    (s, o) => s + o.amountCents,
    0,
  );
  const goalsCycleCents = household.assumptions.goalContributions.reduce(
    (s, g) => s + g.amountCents,
    0,
  );

  // Same-period percentage: the per-check gift over the per-check basis and
  // the per-check bills+goals — numerator and denominator always cover the
  // SAME named period (a check), so 5.57%-vs-2.79% drift is impossible.
  const impact =
    paycheck === null || cycleGivingCents === null
      ? null
      : givingImpact({
          givingCents: cycleGivingCents,
          basisCents:
            plan.basis === "gross" ? paycheck.grossCents : paycheck.netCents,
          billsCents: billsCycleCents,
          goalsCents: goalsCycleCents,
          period: "check",
        });

  const label =
    paycheck === null
      ? givingLabel(plan, {
          payFrequency,
          netCents: 0,
          grossCents: 0,
          givingCents: null,
        })
      : givingLabel(plan, {
          payFrequency,
          netCents: paycheck.netCents,
          grossCents: paycheck.grossCents,
          givingCents: cycleGivingCents,
        });

  return {
    plan,
    cycleGivingCents,
    skipped: resolution === null || resolution.skipped || resolution.givingCents === null,
    resolutionNote:
      resolution !== null && !resolution.skipped && resolution.givingCents === null
        ? resolution.note
        : null,
    impact,
    label,
    periodRowLabel: "This pay period",
    billsCycleCents,
    goalsCycleCents,
  };
}

/* --------------------------------------------- 5. automation previews -- */

export interface AutomationRuleView {
  rule: AutomationRule;
  sourceAccount: Account | null;
  destinationAccount: Account | null;
  linkedDebt: Debt | null;
  paused: boolean;
  /** "Fixed $200.00", "10% of net pay", "Minimum payment on …" */
  amountLabel: string;
  /** Cents this rule would move at its next trigger; null = unresolvable. */
  wouldMoveCents: number | null;
  maxCents: number;
  scheduleLabel: string;
  /** Modeled trigger date; null when the schedule can't be anchored. */
  triggerDate: string | null;
  /**
   * Trigger explanation derived from the SAME scheduling result as the date —
   * a paycheck-relative rule always says which paycheck offset, and a
   * due-date rule always names the linked debt's own due date.
   */
  triggerLabel: string;
  /** Source funds available today (the "from what balance" line). */
  sourceAvailableCents: number | null;
  /** True when the modeled trigger date has passed (stale household). */
  stale: boolean;
  /** Per-day forecast of the source account over the preview window. */
  forecast: CashFlowForecast | null;
  triggerDay: CashFlowDay | null;
  /** null when there is no forecast (unknown balance / no trigger). */
  sufficient: boolean | null;
  incomeUncertain: boolean;
  /** When the amount can't be resolved, what's missing. */
  unresolved: string | null;
}

const SCHEDULE_LABELS: Record<AutomationRule["schedule"], string> = {
  perPaycheck: "per paycheck",
  onDueDate: "on due date",
  weekly: "weekly",
  monthly: "monthly",
};

/** "the day after the next paycheck" spelled from the offset — one source. */
function paycheckOffsetLabel(offsetDays: number, targetDate: string): string {
  const dateLabel = formatWeekdayMonthDay(targetDate);
  if (offsetDays === 0) return `on the next paycheck (${dateLabel})`;
  if (offsetDays === 1) return `the day after the next paycheck (${dateLabel})`;
  return `${offsetDays} days after the next paycheck (${dateLabel})`;
}

/** Resolve what a rule would move at its next trigger, in cents. */
function ruleAmountCents(
  rule: AutomationRule,
  paycheck: Paycheck | null,
  linkedDebt: Debt | null,
): { cents: number | null; label: string; unresolved: string | null } {
  if (rule.amountType === "fixed" && rule.amountCents !== null) {
    return { cents: rule.amountCents, label: `Fixed ${fmt(rule.amountCents)}`, unresolved: null };
  }
  if (rule.amountType === "percent" && rule.percentBps !== null && paycheck) {
    const cents = bpsOfCents(paycheck.netCents, rule.percentBps);
    return {
      cents,
      label: `${rule.percentBps / 100}% of net pay`,
      unresolved: null,
    };
  }
  if (rule.amountType === "formula") {
    if (rule.formula === "minimumPayment") {
      if (linkedDebt) {
        return {
          cents: linkedDebt.minPaymentCents,
          label: `Minimum payment on ${linkedDebt.name} (${fmt(linkedDebt.minPaymentCents)})`,
          unresolved: null,
        };
      }
      return {
        cents: null,
        label: "Formula: minimum payment",
        unresolved:
          "Formula can't be resolved — no linked debt is on record for this rule.",
      };
    }
    if (rule.formula === "fullBalance") {
      return {
        cents: null,
        label: "Formula: full balance",
        unresolved:
          "'Full balance' isn't modeled in this prototype — an amount can't be previewed.",
      };
    }
  }
  return {
    cents: null,
    label: "Amount unresolved",
    unresolved: "This rule's amount type has no resolvable amount.",
  };
}

/**
 * When a perPaycheck / onDueDate rule would next fire, as a modeled date AND
 * its explanation — both from the same scheduling result. Due-date rules
 * resolve through the LINKED DEBT's own statement due day (never the next
 * random bill); if that due date isn't on record the preview says "due date
 * unknown" instead of substituting another obligation.
 */
function ruleTrigger(
  rule: AutomationRule,
  household: Household,
  nowISO: string,
): { date: string | null; label: string } {
  if (rule.schedule === "perPaycheck") {
    const next = nextPaycheck(household);
    if (!next) {
      return { date: null, label: "No upcoming paycheck on record to anchor this preview." };
    }
    const date = addDays(next.date, rule.offsetDays);
    return { date, label: paycheckOffsetLabel(rule.offsetDays, date) };
  }
  if (rule.schedule === "onDueDate") {
    const debt = rule.linkedDebtId
      ? household.debts.find((d) => d.id === rule.linkedDebtId)
      : null;
    if (!debt) {
      return {
        date: null,
        label: "Due date unknown — this rule isn't linked to a debt or obligation.",
      };
    }
    if (debt.minPaymentDueDay == null) {
      return {
        date: null,
        label: `Due date unknown — no statement due date is on record for ${debt.name}.`,
      };
    }
    // The specific debt's next occurrence, strictly after today.
    const due = nextMonthlyOccurrence(debt.minPaymentDueDay, addDays(nowISO, -1));
    const date = addDays(due, rule.offsetDays);
    const offsetNote =
      rule.offsetDays === 0
        ? ""
        : rule.offsetDays === 1
          ? ", the day after"
          : `, ${rule.offsetDays} days after`;
    return {
      date,
      label: `the minimum-payment due date for ${debt.name} (${formatMonthDay(due)}${offsetNote})`,
    };
  }
  // weekly/monthly aren't anchored in the Milestone A data model; model them
  // on the next pay cycle and say so (never invent a more precise date).
  const next = nextPaycheck(household);
  if (!next) {
    return { date: null, label: "No paycheck on record to anchor this preview." };
  }
  const date = addDays(next.date, rule.offsetDays);
  return {
    date,
    label: "the next pay cycle (weekly/monthly schedules are modeled on the pay cycle)",
  };
}

/**
 * Build one rule's preview: what would move, when, from which balance, and
 * whether funds would be sufficient — via forecastCashFlow over the next
 * paycheck window. A rule whose modeled trigger day would dip below zero is
 * flagged `sufficient: false` ("would pause — insufficient funds").
 */
export function automationRuleViews(
  household: Household,
  nowISO: string,
): AutomationRuleView[] {
  const next = nextPaycheck(household);
  return household.automationRules.map((rule) => {
    const sourceAccount =
      household.accounts.find((a) => a.id === rule.sourceAccountId) ?? null;
    const destinationAccount =
      household.accounts.find((a) => a.id === rule.destinationAccountId) ?? null;
    const linkedDebt =
      (rule.linkedDebtId
        ? household.debts.find((d) => d.id === rule.linkedDebtId)
        : null) ?? null;

    const { cents: wouldMoveCents, label: amountLabel, unresolved } =
      ruleAmountCents(rule, next, linkedDebt);

    const trigger = ruleTrigger(rule, household, nowISO);
    const stale = trigger.date !== null && trigger.date < nowISO;
    const sourceAvailableCents = sourceAccount
      ? sourceAccount.availableBalanceCents ?? sourceAccount.currentBalanceCents
      : null;

    let forecast: CashFlowForecast | null = null;
    let triggerDay: CashFlowDay | null = null;
    if (
      sourceAvailableCents !== null &&
      trigger.date !== null &&
      !stale &&
      wouldMoveCents !== null
    ) {
      forecast = forecastForRule(
        household,
        nowISO,
        trigger.date,
        sourceAvailableCents,
        wouldMoveCents,
      );
      triggerDay = forecast.days.find((d) => d.date === trigger.date) ?? null;
    }

    return {
      rule,
      sourceAccount,
      destinationAccount,
      linkedDebt,
      paused: rule.status === "paused",
      amountLabel,
      wouldMoveCents,
      maxCents: rule.maxCents,
      scheduleLabel: SCHEDULE_LABELS[rule.schedule],
      triggerDate: trigger.date,
      triggerLabel: trigger.label,
      sourceAvailableCents,
      stale,
      forecast,
      triggerDay,
      sufficient: triggerDay ? triggerDay.lowCents >= 0 : null,
      incomeUncertain: next !== null && !next.received,
      unresolved,
    };
  });
}

/** Daily forecast of the source account from `now` through `endDate`. */
function forecastForRule(
  household: Household,
  nowISO: string,
  endDate: string,
  startingBalanceCents: number,
  ruleAmountCents: number,
): CashFlowForecast {
  const paycheckDate = nextPaycheck(household)?.date;
  const horizonEnd = paycheckDate && paycheckDate > endDate ? paycheckDate : endDate;
  const span = Math.max(1, daysBetween(nowISO, horizonEnd));
  const dates: string[] = [];
  for (let i = 0; i <= span; i++) dates.push(addDays(nowISO, i));

  const inflows = household.paychecks
    .filter((p) => p.date >= nowISO && p.date <= horizonEnd)
    .map((p) => ({
      date: p.date,
      amountCents: p.netCents,
      estimated: !p.received,
      label: p.employer,
    }));

  // Outflows: obligations landing in the window (alreadyReflected obligations
  // already came out of the available balance — never double-counted), debt
  // minimums due in-window (the same audit the Home plan uses), the adopted
  // extra payment per check, plus the rule's own simulated transfer.
  const outflows: Array<{ date: string; amountCents: number; label: string }> = [];
  for (const obligation of household.obligations) {
    if (obligation.alreadyReflected) continue;
    if (obligation.cadence !== "monthly" || obligation.dueDay === null) continue;
    // Occurrence on/after today (strictly after yesterday's boundary).
    const due = nextMonthlyOccurrence(obligation.dueDay, addDays(nowISO, -1));
    if (due <= horizonEnd) {
      outflows.push({ date: due, amountCents: obligation.amountCents, label: obligation.name });
    }
  }
  for (const min of cycleDebtMinimums(household)) {
    outflows.push({ date: horizonEnd, amountCents: min.amountCents, label: min.name });
  }
  const payFrequency = payFrequencyFor(household);
  const adoptedPerCheck =
    payFrequency === null ? 0 : perMonthToPerCheck(adoptedDebtExtraFor(household), payFrequency);
  if (adoptedPerCheck > 0) {
    outflows.push({
      date: paycheckDate ?? horizonEnd,
      amountCents: adoptedPerCheck,
      label: "Adopted extra debt payment",
    });
  }
  outflows.push({
    date: endDate,
    amountCents: ruleAmountCents,
    label: "Simulated rule transfer",
  });

  return forecastCashFlow(dates, inflows, outflows, startingBalanceCents);
}

function fmt(cents: number): string {
  return formatCents(cents);
}

export { frequencyWord, type GivingFrequency };