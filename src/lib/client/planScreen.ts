/**
 * Plan screen view builders — Phase 3b.
 *
 * Pure, deterministic functions that turn a Household into everything the Plan
 * tab renders: the cycle's bills (exactly-once semantics), the debt strategy
 * comparison, savings goals with confirmed-vs-projected progress, the optional
 * giving plan with factual impact, and simulated automation rules with
 * explicit previews. Nothing here moves money, invents amounts, or implies a
 * transfer happened.
 */
import { debtComparison } from "~/lib/finance/debt";
import { goalProgress } from "~/lib/finance/goals";
import { givingImpact } from "~/lib/finance/giving";
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
  givingForCycle,
  lastReceivedPaycheck,
  nextObligationDueOnOrAfter,
  nextPaycheck,
} from "./plan";
import { householdGoalContributions, debtExtraBudgetFor } from "./household";
import {
  addDays,
  daysBetween,
  formatMonthDay,
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

/* ------------------------------------------------------ 2. debt plans --- */

export interface DebtStrategyView {
  /** The two side-by-side strategies from the engine. */
  comparison: ReturnType<typeof debtComparison>;
  /** The editable extra-payment budget (monthly). */
  extraBudgetCents: number;
  /** Sum of all statement minimums (monthly). */
  minimumsCents: number;
  /** minimums + extra — what the household commits monthly. */
  monthlyTotalCents: number;
}

export function debtStrategyView(
  household: Household,
  nowISO: string,
): DebtStrategyView {
  const extraBudgetCents = debtExtraBudgetFor(household);
  const comparison = debtComparison(household.debts, extraBudgetCents, nowISO);
  const minimumsCents = household.debts.reduce((s, d) => s + d.minPaymentCents, 0);
  return {
    comparison,
    extraBudgetCents,
    minimumsCents,
    monthlyTotalCents: minimumsCents + extraBudgetCents,
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

/** Pay periods per month — demo is biweekly (2), manual single-check (1). */
function cyclesPerMonth(household: Household): number {
  const received = lastReceivedPaycheck(household);
  const next = nextPaycheck(household);
  if (received && next) {
    const gap = daysBetween(received.date, next.date);
    if (gap >= 7 && gap <= 31) return Math.max(1, Math.round(30.44 / gap));
  }
  return 1;
}

export interface GivingView {
  plan: GivingPlan;
  scheduleLabel: string;
  /** The amount the Home plan actually deducts this period; null = skipped. */
  cycleGivingCents: number | null;
  /** Gift computed at the plan's own schedule (e.g. monthly), with impact. */
  impact: ReturnType<typeof givingImpact> | null;
  /** Plain-language summary, e.g. "Fixed — $120.00/month". */
  amountNote: string;
  /** "net pay" or "gross pay" — the basis a percent gift applies to. */
  basisLabel: string;
  /** Monthly bill total behind the impact share. */
  billsMonthlyCents: number;
  /** Monthly goal allocations behind the impact share (a labeled estimate). */
  goalsMonthlyCents: number;
}

export function givingView(household: Household): GivingView {
  const plan = household.givingPlan;
  const paycheck = nextPaycheck(household);
  const scheduleLabel =
    plan.schedule === "perPaycheck"
      ? "per paycheck"
      : plan.schedule === "monthly"
        ? "monthly"
        : "annual";

  const cycleGivingCents =
    paycheck === null ? null : givingForCycle(plan, paycheck.netCents);

  const billsMonthlyCents = household.obligations.reduce(
    (s, o) => s + o.amountCents,
    0,
  );
  const goalsMonthlyCents =
    household.assumptions.goalContributions.reduce(
      (s, g) => s + g.amountCents,
      0,
    ) * cyclesPerMonth(household);

  const impact =
    paycheck === null
      ? null
      : givingImpact(
          plan,
          { grossCents: paycheck.grossCents, netCents: paycheck.netCents },
          { billsCents: billsMonthlyCents, goalsCents: goalsMonthlyCents },
        );

  const basisLabel = plan.basis === "gross" ? "gross pay" : "net pay";
  const amountNote =
    plan.mode === "percent"
      ? `${plan.percentBps === null ? 0 : plan.percentBps / 100}% of ${basisLabel}`
      : `Fixed — ${plan.amountCents === null ? formatCents(0) : formatCents(plan.amountCents)}`;

  return {
    plan,
    scheduleLabel,
    cycleGivingCents,
    impact,
    amountNote,
    basisLabel,
    billsMonthlyCents,
    goalsMonthlyCents,
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

/** When a perPaycheck / onDueDate rule would next fire, as a modeled date. */
function ruleTriggerDate(
  rule: AutomationRule,
  household: Household,
  nowISO: string,
): { date: string; label: string } | null {
  const next = nextPaycheck(household);
  if (rule.schedule === "perPaycheck") {
    if (!next) return null;
    const date = addDays(next.date, rule.offsetDays);
    return { date, label: "the day after the next paycheck" };
  }
  if (rule.schedule === "onDueDate") {
    // Milestone A has no card/statement due dates in the model, so "on due
    // date" is modeled honestly as the NEXT bill due from today — the rule
    // previews against the upcoming due date it can actually see.
    const due = nextObligationDueOnOrAfter(household.obligations, nowISO);
    if (!due) return null;
    const date = addDays(due.dueDate, rule.offsetDays);
    return {
      date,
      label: `the next bill due — ${due.obligation.name} on ${formatMonthDay(due.dueDate)}`,
    };
  }
  // weekly/monthly aren't anchored in the Milestone A data model; model them
  // on the next pay cycle and say so (never invent a more precise date).
  if (!next) return null;
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

    const trigger = ruleTriggerDate(rule, household, nowISO);
    const stale = trigger !== null && trigger.date < nowISO;
    const sourceAvailableCents = sourceAccount
      ? sourceAccount.availableBalanceCents ?? sourceAccount.currentBalanceCents
      : null;

    let forecast: CashFlowForecast | null = null;
    let triggerDay: CashFlowDay | null = null;
    if (
      sourceAvailableCents !== null &&
      trigger !== null &&
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
      triggerDate: trigger?.date ?? null,
      triggerLabel: trigger?.label ?? "Not modeled — no paycheck to anchor to",
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
  // already came out of the available balance — never double-counted) plus the
  // rule's own simulated transfer on its trigger date.
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