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
  Transaction,
} from "~/lib/finance/types";
import type { ImportDraft } from "~/lib/accounts/import";
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
 *   giving: $60/cycle — per-check share of the $120/MONTH demo giving plan on
 *   the demo's twice-monthly pay (10th & 25th): giving/perCheckShare yields
 *   12000 × 12 ÷ 24 = $60/check exactly. Never a hard-coded divide-by-two.
 *   debt extra budget: $250/month WHAT-IF (a demo choice, editable on the
 *   Plan tab) — NOT adopted: adoptedDebtExtraCents starts at 0, so the what-if
 *   never leaks into the Home plan until the user clicks "Apply to my plan".
 *
 * Hand-checked against the engine: with the seeded checking available balance
 * of $1,799.94, the bills due between the Sep 10 and Sep 25 paychecks
 * ($358.70), the debt minimums due inside that window (card 9/22 $96.00 +
 * federal 9/25 $145.00 + medical 9/15 $50.00 = $291.00; auto min was paid on
 * the 9/5 record and private min is due 9/28, after the window),
 * remaining = 1799.94 − 358.70 − 291.00 − 250 − 200 − 60 − 300 = $340.24.
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
  adoptedDebtExtraCents: 0,
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
      adoptedDebtExtraCents: DEMO_PLAN_ASSUMPTIONS.adoptedDebtExtraCents,
    },
  };
}

/** The giving plan record synthesized from the form's giving section. */
function manualGivingPlan(inputs: ManualOnboardingInputs) {
  const base = {
    id: "giv-manual",
    basis: "net" as const,
    categories: ["custom"] as GivingCategory[],
    // The onboarding form enters "amount per check". With a single modeled
    // paycheck there is no pay cadence on record to convert against, so the
    // plan's own cadence is declared as the assumption: per-check giving is
    // stored at frequency "biweekly" and the per-check allocation is the full
    // amount (never divided). Declared assumption, not a silent guess.
    frequency: "biweekly" as const,
    source: "manual" as const,
    notes:
      "Optional giving — chosen by the user during onboarding. 'Per check' is modeled at the plan's own cadence (assumed every 2 weeks) because no pay schedule is on record.",
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
    institution: null,
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
      adoptedDebtExtraCents: 0,
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

/**
 * Read the ADOPTED extra debt payment (per month). 0 = nothing adopted; a
 * what-if scenario budget is never adopted implicitly.
 */
export function adoptedDebtExtraFor(household: Household): number {
  return household.assumptions.adoptedDebtExtraCents ?? 0;
}

/* ------------------------------------------------- phase 3c mutations --- */

/** Deterministic next id for a prefix with a numeric suffix ("imp-3"). */
export function nextIdWithPrefix(prefix: string, existingIds: readonly string[]): string {
  let max = 0;
  for (const id of existingIds) {
    if (!id.startsWith(prefix)) continue;
    const suffix = Number(id.slice(prefix.length));
    if (Number.isSafeInteger(suffix) && suffix > max) max = suffix;
  }
  return `${prefix}${max + 1}`;
}

/** Add an account record (manual entry — no connection implied). */
export function withAddedAccount(household: Household, account: Account): Household {
  return { ...household, accounts: [...household.accounts, account] };
}

/**
 * Delete an account and everything pointing at it: its transactions are
 * removed too, and obligations/paychecks referencing it keep their record but
 * lose the account link (set to null) so no dangling refs survive.
 */
export function withDeletedAccount(
  household: Household,
  accountId: string,
): Household {
  return {
    ...household,
    accounts: household.accounts.filter((a) => a.id !== accountId),
    transactions: household.transactions.filter((t) => t.accountId !== accountId),
    obligations: household.obligations.map((o) =>
      o.accountId === accountId ? { ...o, accountId: null } : o,
    ),
    paychecks: household.paychecks.map((p) =>
      p.accountId === accountId ? { ...p, accountId: null } : p,
    ),
  };
}

/** Prepend a single transaction (manual entry). */
export function withAddedTransaction(
  household: Household,
  transaction: Transaction,
): Household {
  return { ...household, transactions: [transaction, ...household.transactions] };
}

/**
 * Import validated drafts in one batch. Every row gets source "imported"
 * (never "connected"), a unique id, and an explicit statement that nothing
 * here implies a bank connection.
 */
export function withImportedTransactions(
  household: Household,
  drafts: readonly ImportDraft[],
  accountId: string,
): Household {
  const account = household.accounts.find((a) => a.id === accountId);
  if (!account || drafts.length === 0) return household;
  const baseId = nextIdWithPrefix("imp-", household.transactions.map((t) => t.id));
  const startNum = Number(baseId.slice("imp-".length));
  const imported: Transaction[] = drafts.map((d, i) => {
    const id = `imp-${startNum + i}`;
    return {
      id,
      accountId,
      merchant: d.merchant,
      description: d.description,
      amountCents: d.amountCents,
      kind: d.kind,
      status: d.status,
      category: d.category,
      transactedAt: d.dateISO,
      postedAt: d.status === "posted" ? d.dateISO : null,
      splits: [],
      isExcluded: false,
      principalCents: null,
      interestCents: null,
      source: "imported",
    };
  });
  return { ...household, transactions: [...imported, ...household.transactions] };
}

/** Inline category correction — applied to the one transaction the user sees. */
export function withTransactionCategory(
  household: Household,
  txnId: string,
  category: string,
): Household {
  const cleaned = category.trim();
  if (!cleaned) return household;
  return {
    ...household,
    transactions: household.transactions.map((t) =>
      t.id === txnId ? { ...t, category: cleaned } : t,
    ),
  };
}

/** Exclusions toggle — excluded rows leave every spending/income total. */
export function withTransactionExcluded(
  household: Household,
  txnId: string,
  excluded: boolean,
): Household {
  return {
    ...household,
    transactions: household.transactions.map((t) =>
      t.id === txnId ? { ...t, isExcluded: excluded } : t,
    ),
  };
}

/**
 * Mark a transaction as a duplicate of another (or clear the mark).
 * Marking also excludes it from totals; clearing restores it.
 */
export function withTransactionDuplicate(
  household: Household,
  txnId: string,
  ofTxnId: string | null,
): Household {
  return {
    ...household,
    transactions: household.transactions.map((t) =>
      t.id === txnId
        ? { ...t, duplicateOf: ofTxnId, isExcluded: ofTxnId !== null }
        : t,
    ),
  };
}

/** User reviewed a possible-duplicate flag and chose to KEEP the row. */
export function withDuplicateIgnored(
  household: Household,
  txnId: string,
  ignored: boolean,
): Household {
  return {
    ...household,
    transactions: household.transactions.map((t) =>
      t.id === txnId
        ? { ...t, duplicateIgnored: ignored, duplicateOf: ignored ? null : t.duplicateOf }
        : t,
    ),
  };
}

/** Reconcile pending → posted (prototype reconciliation, no bank involved). */
export function withTransactionPosted(
  household: Household,
  txnId: string,
): Household {
  return {
    ...household,
    transactions: household.transactions.map((t) =>
      t.id === txnId && t.status === "pending"
        ? { ...t, status: "posted", postedAt: t.transactedAt }
        : t,
    ),
  };
}

/**
 * Re-label a user-entered expense as a transfer so it is never counted as
 * spending. Demo rows are left alone — their labels are part of the demo.
 */
export function withTransactionTransfer(
  household: Household,
  txnId: string,
): Household {
  return {
    ...household,
    transactions: household.transactions.map((t) =>
      t.id === txnId && t.source !== "demo" && t.kind === "expense"
        ? { ...t, kind: "transfer", category: t.category === "uncategorized" ? "transfers" : t.category }
        : t,
    ),
  };
}

/**
 * Change an account's connection status. In the prototype this is a
 * SIMULATION ONLY — it never touches a real institution. Used for the demo
 * "Reconnect" affordance and for exploring every honest state. Records
 * entered as demo or manual data always keep their honest label — a
 * simulated status can never be faked onto them.
 */
export function withAccountConnectionStatus(
  household: Household,
  accountId: string,
  status: Account["connectionStatus"],
): Household {
  const account = household.accounts.find((a) => a.id === accountId);
  if (!account) return household;
  if (account.connectionStatus === "demo" || account.connectionStatus === "manual") {
    return household; // can't fake a real state onto demo/manual records
  }
  if (status === "demo" || status === "manual") return household;
  return {
    ...household,
    accounts: household.accounts.map((a) =>
      a.id === accountId
        ? { ...a, connectionStatus: status, updatedAt: new Date().toISOString() }
        : a,
    ),
  };
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

/**
 * Adopt a monthly extra debt payment ("Apply to my plan"). Unlike the what-if
 * budget, this value flows into buildHomePlan/forecastCashFlow each period
 * (converted per check via the household's pay cadence). An unaffordable
 * adopted amount produces a visible shortfall — never hidden.
 */
export function withAdoptedDebtExtra(
  household: Household,
  cents: number,
): Household {
  if (!Number.isSafeInteger(cents) || cents < 0) return household;
  return {
    ...household,
    assumptions: { ...household.assumptions, adoptedDebtExtraCents: cents },
  };
}