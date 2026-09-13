/**
 * Account display vocabulary — Phase 3c.
 *
 * Pure, deterministic helpers for the More tab: type labels, connection-state
 * copy (every state shown truthfully), spendable-cash classification, balance
 * line summaries, and timestamp formatting. All money stays integer cents;
 * `null` means "unknown" and is rendered as "Unknown", never 0.
 */
import type {
  Account,
  AccountType,
  ConnectionStatus,
} from "~/lib/finance/types";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  creditCard: "Credit card",
  loan: "Loan",
  studentLoan: "Student loan",
  autoLoan: "Auto loan",
  mortgage: "Mortgage",
  brokerage: "Brokerage",
  retirement: "Retirement",
  manualAsset: "Manual asset",
};

/** Investment/retirement balances are real money but NOT spendable cash. */
const INVESTMENT_TYPES = new Set<AccountType>(["brokerage", "retirement"]);

/** Accounts the household owes money on (balances are negative cents). */
const CREDIT_TYPES = new Set<AccountType>([
  "creditCard",
  "loan",
  "studentLoan",
  "autoLoan",
  "mortgage",
]);

/** Accounts whose balance can move to pay bills today. */
const SPENDABLE_TYPES = new Set<AccountType>(["checking", "savings"]);

/** Money that can be spent on bills without selling/liquidating anything. */
export function isSpendableCash(account: Account): boolean {
  return SPENDABLE_TYPES.has(account.type);
}

/** Brokerage/retirement — explicitly "not spendable cash". */
export function isInvestmentAccount(account: Account): boolean {
  return INVESTMENT_TYPES.has(account.type);
}

/** The household owes money on this account (balance is negative). */
export function isCreditAccount(account: Account): boolean {
  return CREDIT_TYPES.has(account.type);
}

export type ConnectionTone =
  | "demo"
  | "manual"
  | "connected"
  | "stale"
  | "reconnect"
  | "unsupported"
  | "disconnected";

export interface ConnectionMeta {
  /** Short badge label, e.g. "Stale". */
  label: string;
  /** One-line honest explanation used in banners/tooltips. */
  description: string;
  tone: ConnectionTone;
}

export const CONNECTION_META: Record<ConnectionStatus, ConnectionMeta> = {
  demo: {
    label: "Demo",
    description: "Synthetic demo data — no institution is connected.",
    tone: "demo",
  },
  manual: {
    label: "Manual",
    description: "Entered by hand on this device — no connection.",
    tone: "manual",
  },
  connected: {
    label: "Connected",
    description:
      "Simulated connection — in this prototype the data never actually refreshes from an institution.",
    tone: "connected",
  },
  stale: {
    label: "Stale",
    description:
      "This account's balance is out of date. Reconnect (simulated) and refresh before relying on it.",
    tone: "stale",
  },
  reconnectRequired: {
    label: "Reconnect required",
    description:
      "This connection needs re-authorization before new data can arrive.",
    tone: "reconnect",
  },
  unsupported: {
    label: "Unsupported",
    description:
      "This institution can't connect in the prototype. Manual entry still works.",
    tone: "unsupported",
  },
  disconnected: {
    label: "Disconnected",
    description:
      "No longer connected — the balance will not refresh. You can keep the record or delete it.",
    tone: "disconnected",
  },
};

/** Stale/reconnect/unsupported/disconnected accounts get a prominent banner. */
export function needsReconnectBanner(status: ConnectionStatus): boolean {
  return (
    status === "stale" ||
    status === "reconnectRequired" ||
    status === "unsupported" ||
    status === "disconnected"
  );
}

/** Simulated "reconnect" only exists for connection states, never demo/manual. */
export function canSimulateReconnect(account: Account): boolean {
  return (
    account.connectionStatus !== "demo" &&
    account.connectionStatus !== "manual"
  );
}

/** Institution shown on the card; null -> honest fallback, never invented. */
export function institutionLabel(account: Account): string {
  if (account.institution) return account.institution;
  if (account.connectionStatus === "demo") return "Synthetic demo institution";
  if (account.connectionStatus === "manual") return "Manual entry — no institution";
  return "Institution not listed";
}

/* --------------------------------------------------------- formatters ---- */

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "Sep 10, 2026" — UTC-anchored so it never depends on the viewer. */
export function formatDate(iso: string): string {
  return shortDate.format(new Date(iso));
}

const shortDateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

/** "Sep 10, 2026, 8:30 AM" — last-updated timestamps. */
export function formatDateTime(iso: string): string {
  return shortDateTime.format(new Date(iso));
}

/** A source label for badges: "Demo", "Manual", "Imported". */
export function sourceLabel(source: Account["source"]): string {
  return source === "demo" ? "Demo" : source === "imported" ? "Imported" : "Manual";
}

/* --------------------------------------------------- balance display ---- */

export interface BalanceLine {
  label: string;
  /** null = unknown, rendered as "Unknown" (never 0). */
  cents: number | null;
  /** Small suffix, e.g. "you owe" on credit balances. */
  note?: string;
}

export interface BalanceView {
  /** The headline balance line of the card. */
  primary: BalanceLine;
  /** Extra lines (available, credit, limit…) — empty when nothing differs. */
  lines: BalanceLine[];
  /** True when the account balance is money the household owes. */
  isDebt: boolean;
}

/**
 * What an account card shows, truthfully: current vs available where they
 * differ, available credit + limit for cards, magnitudes for anything the
 * household owes, and null → "Unknown" everywhere.
 */
export function balanceView(account: Account): BalanceView {
  const debt = isCreditAccount(account);
  const magnitude = (cents: number | null) => (cents === null ? null : Math.abs(cents));

  if (account.type === "creditCard") {
    return {
      primary: { label: "Balance", cents: magnitude(account.currentBalanceCents), note: "you owe" },
      lines: [
        { label: "Available credit", cents: account.availableCreditCents },
        { label: "Credit limit", cents: account.creditLimitCents },
      ].filter((l) => l.cents !== null),
      isDebt: true,
    };
  }

  if (debt) {
    return {
      primary: { label: "Balance", cents: magnitude(account.currentBalanceCents), note: "you owe" },
      lines: [],
      isDebt: true,
    };
  }

  // Owned accounts: current first; available only when it differs.
  const current = account.currentBalanceCents;
  const available = account.availableBalanceCents;
  const lines: BalanceLine[] = [];
  if (available !== null && available !== current) {
    lines.push({ label: "Available", cents: available });
  }
  return { primary: { label: "Balance", cents: current }, lines, isDebt: false };
}