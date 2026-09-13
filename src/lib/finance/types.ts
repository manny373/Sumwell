/**
 * Sumwell finance data model — Phase 2.
 *
 * Conventions every module in src/lib/finance relies on:
 * - ALL money is integer minor units (cents). Floats never enter a money path.
 *   `null` means "unknown / not applicable" and is NEVER silently treated as 0.
 * - Signed balances follow accounting convention: an account the household
 *   OWNS has a positive balance; a credit card or loan account the household
 *   OWES has a NEGATIVE currentBalanceCents and a positive Debt record.
 * - Transactions are signed from the account's perspective: money out of a
 *   spend account (or a purchase on a card) is negative; money in is positive.
 * - Every entity carries a `source` label ("demo" | "manual" | "imported") so
 *   the UI can always say where its data came from. Nothing in this model
 *   implies an external connection, an offer, a score, or a payment success.
 */

export type CurrencyCode = "USD";

/** Where the data came from — shown next to every number in the UI. */
export type DataSource = "demo" | "manual" | "imported";

/**
 * Connection state of an account record. Only `demo` and `manual` exist in
 * Milestone A; the rest are truthful states for later/labeled-simulated data.
 */
export type ConnectionStatus =
  | "demo"
  | "manual"
  | "connected"
  | "stale"
  | "reconnectRequired"
  | "unsupported"
  | "disconnected";

export type AccountType =
  | "checking"
  | "savings"
  | "creditCard"
  | "loan"
  | "studentLoan"
  | "autoLoan"
  | "mortgage"
  | "brokerage"
  | "retirement"
  | "manualAsset";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  connectionStatus: ConnectionStatus;
  source: DataSource;
  owner: string;
  currency: CurrencyCode;
  /** Statement/current balance. Unknown => null (never 0). */
  currentBalanceCents: number | null;
  /** Funds you can actually move/spend (may already reflect pending). Unknown => null. */
  availableBalanceCents: number | null;
  /** Credit still available on a credit account. Unknown => null. */
  availableCreditCents: number | null;
  /** Credit limit on a credit account. Unknown => null. */
  creditLimitCents: number | null;
  /** The institution's own id when connected; null when demo/manual. */
  externalId: string | null;
  /** Display name of the institution the account lives at (synthetic for demo). */
  institution: string | null;
  /** ISO date the account was opened, when known. */
  openedAt: string | null;
  /** ISO timestamp — when the balance/source data was last updated. */
  updatedAt: string;
}

export type TransactionStatus = "pending" | "posted";

/**
 * Why a transaction happened. `transfer` and `loanPayment` are commitments,
 * NOT spending events — they can never be double-counted as expenses. A
 * loan payment records its principal/interest split separately; the payment
 * itself counts once.
 */
export type TransactionKind = "expense" | "income" | "transfer" | "loanPayment";

export interface TransactionSplit {
  id: string;
  category: string;
  /** Positive share of the transaction magnitude; splits sum to |amountCents|. */
  amountCents: number;
  note?: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  merchant: string;
  description?: string;
  /** Signed from the account's perspective (see module header). */
  amountCents: number;
  kind: TransactionKind;
  status: TransactionStatus;
  category: string;
  /** ISO date the transaction happened. */
  transactedAt: string;
  /** ISO date it posted; null while pending. */
  postedAt: string | null;
  splits: TransactionSplit[];
  /** User-excluded from spending/category views (not "cancelled"). */
  isExcluded: boolean;
  /** Loan payments: principal portion. null when not a loan payment. */
  principalCents: number | null;
  /** Loan payments: interest portion. null when not a loan payment. */
  interestCents: number | null;
  /**
   * When set, this transaction was reviewed and marked as a duplicate of
   * `duplicateOf` and is excluded from spending/income totals. Absent = not
   * flagged as a duplicate.
   */
  duplicateOf?: string | null;
  /** User reviewed a possible-duplicate flag and chose to keep this row. */
  duplicateIgnored?: boolean;
  source: DataSource;
}

export interface Paycheck {
  id: string;
  /** ISO pay date. */
  date: string;
  employer: string;
  grossCents: number;
  netCents: number;
  /** false = expected/estimated until it actually arrives. */
  received: boolean;
  accountId: string | null;
  source: DataSource;
}

export type ObligationCadence = "monthly" | "weekly" | "biweekly" | "annual" | "once";

/**
 * A recurring bill (rent, utilities, subscriptions…).
 * The plan layer decides which obligations fall inside a given paycheck window.
 */
export interface Obligation {
  id: string;
  name: string;
  amountCents: number;
  cadence: ObligationCadence;
  /** Day of month (1–31) for monthly cadence. */
  dueDay: number | null;
  category: string;
  /** Required for the household (rent, utilities) vs discretionary. */
  essential: boolean;
  /**
   * True when this period's amount already sits inside the account's
   * available balance (e.g. it is a posted/pending transaction). Plans must
   * NOT deduct it again.
   */
  alreadyReflected: boolean;
  accountId: string | null;
  source: DataSource;
  notes?: string;
}

export type DebtCategory =
  | "creditCard"
  | "studentLoan"
  | "autoLoan"
  | "mortgage"
  | "personalLoan"
  | "medical"
  | "other";

/** "unknown" means the APR is not known — never invent one. */
export type AprKind = "fixed" | "variable" | "promotional" | "unknown";

export interface Debt {
  id: string;
  name: string;
  category: DebtCategory;
  /** Outstanding balance, positive magnitude. */
  balanceCents: number;
  /** Annual percentage rate in basis points (1 bps = 0.01%). null = unknown. */
  aprBps: number | null;
  aprKind: AprKind;
  /** e.g. "0% until Apr 2027" when promotional. */
  promoTerms?: string;
  promoEndDate?: string | null;
  minPaymentCents: number;
  /** True when the min payment is an estimate (e.g. 1% of balance) rather than a statement number. */
  minPaymentIsEstimate: boolean;
  source: DataSource;
  notes?: string;
}

export type GoalKind = "emergencyFund" | "custom";

export interface Goal {
  id: string;
  name: string;
  kind: GoalKind;
  targetCents: number;
  /** Current saved amount — the source of truth for "where the goal stands". */
  savedCents: number;
  /** 1 = highest priority. */
  priority: number;
  source: DataSource;
}

export type GoalContributionSource =
  | "manual"
  | "paycheckAllocation"
  | "userEntered"
  | "projected";

export interface GoalContribution {
  id: string;
  goalId: string;
  amountCents: number;
  /** ISO date the contribution happened (or is planned, when projected). */
  date: string;
  /** "projected" = plan line item, NOT an event that happened. */
  source: GoalContributionSource;
  /** confirmed = dated + sourced from reality (manual entry / executed allocation). */
  confirmed: boolean;
  note?: string;
}

export type GivingCategory = "tithe" | "offerings" | "charities" | "mutualAid" | "custom";
export type GivingMode = "fixed" | "percent";
export type GivingBasis = "gross" | "net";
export type GivingSchedule = "perPaycheck" | "monthly" | "annual";

/**
 * Optional giving plan. The USER chooses amount/timing/priority — the product
 * never preselects a percentage or implies tax deductibility.
 */
export interface GivingPlan {
  id: string;
  mode: GivingMode;
  /** Fixed mode only. */
  amountCents: number | null;
  /** Percent mode only (1000 = 10%). */
  percentBps: number | null;
  /** What a percent gift applies to. */
  basis: GivingBasis;
  categories: GivingCategory[];
  schedule: GivingSchedule;
  enabled: boolean;
  source: DataSource;
  notes?: string;
}

export type AutomationRuleStatus = "draft" | "paused" | "active";
export type AutomationAmountType = "fixed" | "percent" | "formula";
export type AutomationFormula = "minimumPayment" | "fullBalance";

/**
 * Automation rule — DATA ONLY. Milestone A never executes rules; a rule is
 * never proof of payment permission or of a successful transfer.
 */
export interface AutomationRule {
  id: string;
  name: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amountType: AutomationAmountType;
  /** fixed mode only. */
  amountCents: number | null;
  /** percent mode only — percent of paycheck net. */
  percentBps: number | null;
  /** formula mode only, e.g. minimum on the destination debt. */
  formula: AutomationFormula | null;
  /** Cap per trigger. */
  maxCents: number;
  schedule: "perPaycheck" | "onDueDate" | "weekly" | "monthly";
  offsetDays: number;
  status: AutomationRuleStatus;
  /** Always true in Milestone A — rules are simulated, data only. */
  simulated: true;
  /** Explicit authorization record (data), when given. */
  authorizedAt: string | null;
  revokedAt: string | null;
  /**
   * Debt this rule pays (when formula/destination target a debt). Lets the
   * preview resolve "minimumPayment" without guessing. Optional — a rule with
   * no linked debt and a formula amount simply has no resolvable amount.
   */
  linkedDebtId?: string | null;
  source: DataSource;
}

export type CommitmentKind = "obligation" | "essential" | "goal" | "giving" | "buffer";

/** One line in a plan's commitment ledger. */
export interface CommitmentLedgerEntry {
  id: string;
  kind: CommitmentKind;
  name: string;
  amountCents: number;
  /** false = already reflected in the available balance; never deducted. */
  deducted: boolean;
  note?: string;
}