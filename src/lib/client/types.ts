/**
 * Client data layer — Phase 3a.
 *
 * The household is the shape the app works on: it wraps the Phase 2 finance
 * model (accounts, paychecks, obligations, debts, goals, giving, automation)
 * plus the per-cycle PLAN ASSUMPTIONS the engine needs that the finance
 * entities don't carry (essential spending per cycle, checking buffer, and the
 * accepted goal contributions for this period).
 *
 * Two builders produce a Household:
 *   - demoHousehold(): wraps the deterministic demo snapshot from Phase 2
 *     (createDemoSnapshot) with demo plan assumptions.
 *   - manualHouseholdFor(): synthesizes a minimal manual household from the
 *     onboarding form. Every entity is source: "manual".
 *
 * ALL money remains integer cents. Nothing here touches a server; the whole
 * state persists to localStorage under one key ("sumwell:v1").
 */
import type {
  Account,
  AutomationRule,
  Debt,
  GivingPlan,
  Goal,
  Obligation,
  Paycheck,
  Transaction,
} from "~/lib/finance/types";

/** Accepted goal contributions for the CURRENT paycheck period. */
export interface AcceptedGoalContribution {
  goalId: string;
  name: string;
  amountCents: number;
}

/** Per-cycle planning assumption not carried by the finance entities. */
export interface PlanAssumptions {
  /** Estimated non-bill essential spending for this period. */
  essentialsPerCycleCents: number;
  /** The checking buffer kept aside — money that is not spent. */
  bufferCents: number;
  /** Goal contributions the user accepted for this period. */
  goalContributions: AcceptedGoalContribution[];
}

export type HouseholdSource = "demo" | "manual";

/** The full working household: finance entities + plan assumptions. */
export interface Household {
  source: HouseholdSource;
  /** Short human label, e.g. "Demo household" or "Your household". */
  label: string;
  /** When the household was first created (ISO timestamp). */
  createdAt: string;
  /** When this data was generated/updated (ISO timestamp). */
  generatedAt: string;
  accounts: Account[];
  transactions: Transaction[];
  paychecks: Paycheck[];
  obligations: Obligation[];
  debts: Debt[];
  goals: Goal[];
  givingPlan: GivingPlan;
  automationRules: AutomationRule[];
  assumptions: PlanAssumptions;
}

/** What the app persists to localStorage under "sumwell:v1". */
export interface PersistedAppState {
  version: 1;
  /** True once any path of onboarding completed (drives / → Home routing). */
  onboarded: boolean;
  household: Household | null;
  /** When this state was last saved (ISO timestamp). */
  savedAt: string;
}

/* ------------------------------------------------------------ onboarding */

export type GivingChoice = "skip" | "fixed" | "percent";

export interface ManualGivingInput {
  choice: GivingChoice;
  /** Per-check fixed amount (cents) when choice === "fixed". */
  fixedCents: number | null;
  /** Percent of net pay per check in basis points (1000 = 10%) when choice === "percent". */
  percentBps: number | null;
}

export interface ManualObligationInput {
  id: string;
  name: string;
  amountCents: number;
  /** Day of month (1–31) the bill is due. */
  dueDay: number;
}

export interface ManualGoalInput {
  name: string;
  targetCents: number;
  /** Accepted contribution per cycle. */
  perCycleCents: number;
}

export interface ManualOnboardingInputs {
  /** Money available in checking right now. */
  availableCents: number;
  /** Next pay date (ISO). */
  payDate: string;
  /** Estimated net pay for that check. */
  netPayCents: number;
  obligations: ManualObligationInput[];
  essentialsPerCycleCents: number;
  bufferCents: number;
  goal: ManualGoalInput | null;
  giving: ManualGivingInput;
  /** When editing, preserve the original household creation time. */
  createdAt?: string;
}