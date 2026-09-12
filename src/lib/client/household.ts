/**
 * Household builders — Phase 3a.
 *
 * demoHousehold(): wraps the deterministic Phase 2 demo snapshot
 * (createDemoSnapshot) with the demo plan assumptions. The snapshot itself is
 * deep-frozen; the wrapper copies its arrays into a fresh, mutable Household
 * (the store may evolve it later) without changing any seeded value.
 *
 * manualHouseholdFor(): synthesizes a minimal manual household from the
 * onboarding form. Every entity is source: "manual", there are no debts and
 * no transactions yet (Plan/Progress/More tabs will grow them), and nothing
 * implies a bank connection, an offer, a score, or a payment success.
 *
 * All amounts are integer cents.
 */
import type {
  Account,
  AutomationRule,
  AutomationRuleStatus,
  GivingCategory,
  GivingPlan,
  Goal,
  Obligation,
  Paycheck,
} from "~/lib/finance/types";
import { createDemoSnapshot } from "~/lib/finance/seed";
import type {
  Household,
  ManualOnboardingInputs,
  PlanAssumptions,
} from "./types";

/** Manual household display name (also used as account owner). */
export const MANUAL_HOUSEHOLD_LABEL = "Your household";

/**
 * Demo plan assumptions — the per-cycle numbers the demo needs that the Phase
 * 2 snapshot doesn't carry. These sit next to the seeded data and are shown in
 * the UI as demo assumptions, editable from Home via the "edit" path.
 *
 *   essentials: $250/cycle · buffer: $300/cycle · emergency fund: $200/cycle
 *   giving: $60/cycle (per-check share of the $120/month demo giving plan on
 *   biweekly pay — see givingForCycle in ./plan.ts)
 *   debt extra budget: $250/month (a demo choice — editable on the Plan tab)
 *
 * Hand-checked against the engine: with the seeded checking available balance
 * of $1,799.94 and the bills due between the Sep 10 and Sep 25 paychecks
 * ($358.70), remaining = 1799.94 − 358.70 − 250 − 200 − 60 − 300 = $631.24.
 */
export const DEMO_PLAN_ASSUMPTIONS: PlanAssumptions = {
  essentialsPerCycleCents: 25000,
  bufferCents: 30000,
  goalContributions: [
    {
      goalId: "goal-emergency",
      name: "Emergency fund",
      amountCents: 20000,
    },
  ],
  debtExtraBudgetCents: 25000,
};

/** Copy the frozen demo snapshot into a mutable Household wrapper. */
export function demoHousehold(createdAt?: string): Household {
  const snapshot = createDemoSnapshot();
  return {
    source: "demo",
    label: snapshot.household,
    createdAt: createdAt ?? new Date().toISOString(),
    generatedAt: snapshot.generatedAt,
    accounts: [...snapshot.accounts],
    transactions: [...snapshot.transactions],
    paychecks: [...snapshot.paychecks],
    obligations: [...snapshot.obligations],
    debts: [...snapshot.debts],
    goals: [...snapshot.goals],
    goalContributions: [...snapshot.goalContributions],
    givingPlan: { ...snapshot.givingPlan },
    automationRules: [...snapshot.automationRules],
    assumptions: {
      essentialsPerCycleCents: DEMO_PLAN_ASSUMPTIONS.essentialsPerCycleCents,
      bufferCents: DEMO_PLAN_ASSUMPTIONS.bufferCents,
      goalContributions: DEMO_PLAN_ASSUMPTIONS.goalContributions.map((g) => ({
        ...g,
      })),
      debtExtraBudgetCents: DEMO_PLAN_ASSUMPTIONS.debtExtraBudgetCents,
    },
  };
}

/** The giving plan record synthesized from the form's giving section. */
function manualGivingPlan(inputs: ManualOnboardingInputs) {
  const base = {
    id: "giv-manual",
    basis: "net" as const,
    categories: ["custom"] as GivingCategory[],
    schedule: "perPaycheck" as const,
    source: "manual" as const,
    notes: "Optional giving — chosen by the user during onboarding.",
  };
  if (inputs.giving.choice === "fixed" && inputs.giving.fixedCents !== null) {
    return {
      ...base,
      mode: "fixed" as const,
      amountCents: inputs.giving.fixedCents,
      percentBps: null,
      enabled: true,
    };
  }
  if (inputs.giving.choice === "percent" && inputs.giving.percentBps !== null) {
    return {
      ...base,
      mode: "percent" as const,
      amountCents: null,
      percentBps: inputs.giving.percentBps,
      enabled: true,
    };
  }
  return {
    ...base,
    mode: "fixed" as const,
    amountCents: null,
    percentBps: null,
    enabled: false,
  };
}

/**
 * Build a manual household from the onboarding inputs.
 * `now` is the ISO timestamp used for updatedAt/generatedAt (injected for
 * determinism in tests).
 */
export function manualHouseholdFor(
  inputs: ManualOnboardingInputs,
  now: string,
): Household {
  const checking: Account = {
    id: "acc-checking",
    name: "Checking (manual)",
    type: "checking",
    connectionStatus: "manual",
    source: "manual",
    owner: MANUAL_HOUSEHOLD_LABEL,
    currency: "USD",
    currentBalanceCents: inputs.availableCents,
    availableBalanceCents: inputs.availableCents,
    availableCreditCents: null,
    creditLimitCents: null,
    externalId: null,
    openedAt: null,
    updatedAt: now,
  };

  const paycheck: Paycheck = {
    id: "pc-next",
    date: inputs.payDate,
    // Gross was not captured by the minimal onboarding form; nothing in the
    // Milestone A Home plan reads gross (giving percent uses net). Kept equal
    // to net so the record is internally consistent, documented as unknown.
    employer: "Your payroll",
    grossCents: inputs.netPayCents,
    netCents: inputs.netPayCents,
    received: false,
    accountId: "acc-checking",
    source: "manual",
  };

  const obligations: Obligation[] = inputs.obligations.map((o) => ({
    id: o.id,
    name: o.name,
    amountCents: o.amountCents,
    cadence: "monthly",
    dueDay: o.dueDay,
    category: "bills",
    essential: true,
    alreadyReflected: false,
    accountId: null,
    source: "manual",
    notes: "Entered during onboarding.",
  }));

  const automationRules: AutomationRule[] = [];

  return {
    source: "manual",
    label: MANUAL_HOUSEHOLD_LABEL,
    createdAt: inputs.createdAt ?? now,
    generatedAt: now,
    accounts: [checking],
    transactions: [],
    paychecks: [paycheck],
    obligations,
    debts: [],
    goals: inputs.goal
      ? [
          {
            id: "goal-manual",
            name: inputs.goal.name,
            kind: "custom",
            targetCents: inputs.goal.targetCents,
            savedCents: 0,
            priority: 1,
            source: "manual",
          },
        ]
      : [],
    givingPlan: manualGivingPlan(inputs),
    automationRules,
    goalContributions: [],
    assumptions: {
      essentialsPerCycleCents: inputs.essentialsPerCycleCents,
      bufferCents: inputs.bufferCents,
      goalContributions: inputs.goal
        ? [
            {
              goalId: "goal-manual",
              name: inputs.goal.name,
              amountCents: inputs.goal.perCycleCents,
            },
          ]
        : [],
      debtExtraBudgetCents: 0,
    },
  };
}

/* ------------------------------------------------- phase 3b mutations --- */
/**
 * Pure household mutations for Phase 3b screens. Each returns a NEW household
 * (the caller, usually the store, persists it); inputs are never mutated.
 * They live here rather than in components so every change path is unit-testable.
 */

/** Read goal contributions defensively (older persisted states lack the field). */
export function householdGoalContributions(
  household: Household,
): Household["goalContributions"] {
  return household.goalContributions ?? [];
}

/** Read the extra debt budget; older persisted states fall back per-source. */
export function debtExtraBudgetFor(household: Household): number {
  return (
    household.assumptions.debtExtraBudgetCents ??
    (household.source === "demo" ? 25000 : 0)
  );
}

/** Replace the giving plan (mode, amount/percent, enabled). */
export function withGivingPlan(household: Household, plan: GivingPlan): Household {
  return { ...household, givingPlan: { ...plan } };
}

/** Set a rule's status (draft = armed preview, paused = opted out). */
export function withRuleStatus(
  household: Household,
  ruleId: string,
  status: AutomationRuleStatus,
): Household {
  return {
    ...household,
    automationRules: household.automationRules.map((r) =>
      r.id === ruleId ? { ...r, status } : r,
    ),
  };
}

/** Pause every rule (or resume all paused → draft). Same control, both ways. */
export function withAllRulesPaused(
  household: Household,
  paused: boolean,
): Household {
  return {
    ...household,
    automationRules: household.automationRules.map((r) => ({
      ...r,
      status: paused ? "paused" : r.status === "paused" ? "draft" : r.status,
    })),
  };
}

/**
 * Re-prioritize goals: move `goalId` to `newPriority` (1 = highest) and
 * renumber the others so priorities stay a clean 1..n with no collisions.
 */
export function withGoalPriority(
  household: Household,
  goalId: string,
  newPriority: number,
): Household {
  const goals = household.goals;
  const target = goals.find((g) => g.id === goalId);
  if (!target) return household;
  if (!Number.isInteger(newPriority) || newPriority < 1 || newPriority > goals.length) {
    return household;
  }
  if (target.priority === newPriority) return household;
  const others = goals
    .filter((g) => g.id !== goalId)
    .slice()
    .sort((a, b) => a.priority - b.priority);
  const renumbered: Goal[] = others.map((g, i) => ({
    ...g,
    // Slots 1..n with `newPriority` reserved for the moved goal.
    priority: i + 1 < newPriority ? i + 1 : i + 2,
  }));
  const moved: Goal = { ...target, priority: newPriority };
  return {
    ...household,
    goals: [...renumbered, moved].sort((a, b) => a.priority - b.priority),
  };
}

/** Update the monthly extra debt budget stored in the plan assumptions. */
export function withDebtExtraBudget(
  household: Household,
  cents: number,
): Household {
  if (!Number.isSafeInteger(cents) || cents < 0) return household;
  return {
    ...household,
    assumptions: { ...household.assumptions, debtExtraBudgetCents: cents },
  };
}