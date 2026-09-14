/**
 * Progress screen view builders — Phase 3b + Phase 4a (Finding 5).
 *
 * Confirmed changes are derived ONLY from dated, sourced records (transactions
 * and confirmed goal contributions) — never from the plan and never from the
 * app itself. Projected line items stay in a separate channel with an "if you
 * follow this plan" label. Nothing here credits Sumwell with progress.
 *
 * Evidence model (Phase 4a):
 *   - A recorded payment supports exactly "Payment recorded — $X" plus the
 *     balance TODAY. A NET balance reduction claim requires comparable dated
 *     balances over a defined period; the seed has no balance history, so the
 *     app never infers a reduction or interest savings from a payment alone.
 *   - Every change carries an evidenceId; "View evidence" resolves to the
 *     actual transaction/contribution record via evidenceRecordFor.
 *   - Internal record ids appear ONLY inside a labeled technical-details
 *     affordance (the UI renders `<details>`), never in ordinary copy.
 */
import { goalProgress } from "~/lib/finance/goals";
import type { GoalContribution, Transaction } from "~/lib/finance/types";
import { formatCents } from "~/lib/money";
import { householdGoalContributions } from "./household";
import { lastReceivedPaycheck } from "./plan";
import { projectedGoalContributions } from "./planScreen";
import type { Household } from "./types";

export type ConfirmedChangeKind =
  | "debtPrincipalPaid"
  | "debtPaymentRecorded"
  | "savingsContribution";

/** One dated, evidenced change. `amountCents` is the positive magnitude. */
export interface ConfirmedChange {
  id: string;
  date: string; // ISO
  kind: ConfirmedChangeKind;
  title: string;
  amountCents: number;
  /** Factual copy about the RECORD only — no inferred reductions/savings. */
  detail: string;
  /** The transaction or contribution id that is this change's evidence. */
  evidenceId: string;
  /**
   * Balance TODAY from the account record, when the change is a payment into
   * an account that carries a known balance. A balance figure is stated as
   * "balance today" and never spun into a "reduction" claim.
   */
  balanceTodayCents: number | null;
  balanceTodayAccountName: string | null;
  /** Internal record reference for the technical-details affordance. */
  technicalId: string;
}

const CREDIT_ACCOUNT_TYPES = new Set([
  "creditCard",
  "loan",
  "studentLoan",
  "autoLoan",
  "mortgage",
]);

function paymentEvidenceTxn(household: Household, txn: Transaction): ConfirmedChange | null {
  const byId = new Map(household.accounts.map((a) => [a.id, a]));
  const account = byId.get(txn.accountId);
  if (!account) return null;
  // Payments INTO a credit/loan account (positive transfer) or loan payments.
  const isCreditPayment =
    txn.kind === "transfer" && txn.amountCents > 0 && CREDIT_ACCOUNT_TYPES.has(account.type);
  if (isCreditPayment) {
    const owed = household.debts.find(
      (d) => d.accountId === account.id,
    );
    return {
      id: `credit-${txn.id}`,
      date: txn.transactedAt,
      kind: "debtPaymentRecorded" as const,
      title: "Payment recorded",
      amountCents: txn.amountCents,
      detail: `A payment of ${formatCents(txn.amountCents)} to ${account.name} is on record. This records the payment itself — a change in the balance would need dated balances over a defined period, and none are on record yet.`,
      evidenceId: txn.id,
      balanceTodayCents:
        owed !== undefined
          ? owed.balanceCents
          : account.currentBalanceCents !== null
            ? -account.currentBalanceCents
            : null,
      balanceTodayAccountName: owed !== undefined ? owed.name : null,
      technicalId: txn.id,
    };
  }
  return null;
}

/** Debt principals paid and balances reduced — straight from transactions. */
export function confirmedDebtChanges(household: Household): ConfirmedChange[] {
  const changes: ConfirmedChange[] = [];
  for (const txn of household.transactions) {
    if (txn.status === "pending") continue; // not confirmed until posted
    if (txn.kind === "loanPayment" && txn.principalCents !== null) {
      changes.push({
        id: `debt-${txn.id}`,
        date: txn.transactedAt,
        kind: "debtPrincipalPaid",
        title: "Debt principal paid",
        amountCents: txn.principalCents,
        detail: `${txn.merchant} — payment on record; the principal portion is stated on the record itself (interest is separate).`,
        evidenceId: txn.id,
        balanceTodayCents: null,
        balanceTodayAccountName: null,
        technicalId: txn.id,
      });
      continue;
    }
    const payment = paymentEvidenceTxn(household, txn);
    if (payment) changes.push(payment);
  }
  return changes;
}

/** Confirmed goal deposits (dated, sourced; the note is the evidence). */
export function confirmedGoalChanges(household: Household): ConfirmedChange[] {
  const goalsById = new Map(household.goals.map((g) => [g.id, g]));
  return householdGoalContributions(household)
    .filter((c) => c.confirmed && c.source !== "projected")
    .map((c) => ({
      id: `goal-${c.id}`,
      date: c.date,
      kind: "savingsContribution" as const,
      title: `${goalsById.get(c.goalId)?.name ?? "Goal"} contribution`,
      amountCents: c.amountCents,
      detail:
        c.note ??
        `Deposit on record for ${c.date}.`,
      evidenceId: c.id,
      balanceTodayCents: null,
      balanceTodayAccountName: null,
      technicalId: c.id,
    }));
}

/** Every confirmed change, newest first. */
export function allConfirmedChanges(household: Household): ConfirmedChange[] {
  return [...confirmedDebtChanges(household), ...confirmedGoalChanges(household)]
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? 1 : -1));
}

/* ------------------------------------------------------------ evidence -- */

export interface EvidenceRecord {
  /** What kind of record backs this change. */
  recordType: "transaction" | "goalContribution";
  /** Human heading shown in the evidence view. */
  heading: string;
  /** Field/value rows rendered from the ACTUAL record (no inference). */
  rows: Array<{ label: string; value: string }>;
  /** The raw record id — only for the technical-details affordance. */
  technicalId: string;
}

/**
 * Resolve a confirmed change to the ACTUAL record that evidences it. Returns
 * null when the record no longer exists — the UI must say "record not found"
 * rather than invent one.
 */
export function evidenceRecordFor(
  household: Household,
  change: ConfirmedChange,
): EvidenceRecord | null {
  const txn = household.transactions.find((t) => t.id === change.evidenceId);
  if (txn) {
    const account = household.accounts.find((a) => a.id === txn.accountId);
    return {
      recordType: "transaction",
      heading: `${txn.merchant} — ${txn.status === "posted" ? "posted" : "pending"}`,
      rows: [
        { label: "Date", value: txn.transactedAt },
        { label: "Account", value: account?.name ?? "Unknown account" },
        {
          label: "Amount",
          value: formatCents(txn.amountCents, { signed: true }),
        },
        { label: "Status", value: txn.status },
        { label: "Source", value: txn.source },
      ],
      technicalId: txn.id,
    };
  }
  const contribution = householdGoalContributions(household).find(
    (c) => c.id === change.evidenceId,
  );
  if (contribution) {
    return {
      recordType: "goalContribution",
      heading: `Goal contribution on record`,
      rows: [
        { label: "Date", value: contribution.date },
        { label: "Amount", value: formatCents(contribution.amountCents) },
        { label: "Source", value: contribution.source },
        { label: "Confirmed", value: contribution.confirmed ? "yes" : "no" },
      ],
      technicalId: contribution.id,
    };
  }
  return null;
}

export interface CheckInSummary {
  /** Window anchor label, e.g. "since your last paycheck on Sep 10, 2026". */
  windowLabel: string;
  /** The confirmed changes that happened inside the window, newest first. */
  changes: ConfirmedChange[];
  /** Plain-language message for the card. */
  message: string;
}

/**
 * "What changed since your last check-in" — the check-in is modeled honestly
 * as the last received paycheck (real, dated money on record). When the data
 * doesn't support a window, the message is the honest "No confirmed changes
 * yet" empty state.
 */
export function checkInSummary(household: Household): CheckInSummary {
  const lastReceived = lastReceivedPaycheck(household);
  if (!lastReceived) {
    return {
      windowLabel: "since you started this household",
      changes: [],
      message:
        "No confirmed changes yet — nothing on record has moved since this household was set up.",
    };
  }
  const all = allConfirmedChanges(household);
  const inWindow = all.filter((c) => c.date > lastReceived.date);
  return {
    windowLabel: `since your last paycheck on ${lastReceived.date}`,
    changes: inWindow,
    message:
      inWindow.length === 0
        ? "No confirmed changes yet — nothing dated after your last paycheck has moved. Earlier changes are listed below."
        : "These confirmed changes happened after your last paycheck — each one has a dated record.",
  };
}

/* ------------------------------------------------------------- goals ----- */

export interface GoalProgressView {
  goal: ReturnType<typeof goalProgress>;
  /** The accepted per-cycle allocation behind the projected line. */
  acceptedCents: number;
  /** The projected line items, dated at the next paycheck. */
  projected: GoalContribution[];
}

/**
 * Per-goal progress with confirmed history and projected line items kept
 * strictly separate (goalProgress never merges them; projections carry an
 * "if you follow this plan" label in the UI).
 */
export function goalProgressViews(household: Household): GoalProgressView[] {
  const projected = projectedGoalContributions(household);
  const all: GoalContribution[] = [
    ...householdGoalContributions(household),
    ...projected,
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
    projected: projected.filter((p) => p.goalId === goal.id),
  }));
}