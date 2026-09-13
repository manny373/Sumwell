import type { ReactNode } from "react";
import type { AccountType, ConnectionStatus, Transaction } from "~/lib/finance/types";
import {
  ACCOUNT_TYPE_LABELS,
  CONNECTION_META,
  formatDateTime,
  sourceLabel,
  type ConnectionTone,
} from "~/lib/accounts/accounts";
import { cn } from "~/lib/cn";
import {
  BankIcon,
  BoxIcon,
  CardIcon,
  GradIcon,
  HomeIcon,
  LoanIcon,
  ShieldIcon,
  TrendsIcon,
  WalletIcon,
} from "~/components/icons";

/* -------------------------------------------------- account type icon ---- */

const TYPE_ICONS: Record<AccountType, (props: { className?: string }) => ReactNode> = {
  checking: WalletIcon,
  savings: BankIcon,
  creditCard: CardIcon,
  loan: LoanIcon,
  studentLoan: GradIcon,
  autoLoan: LoanIcon,
  mortgage: HomeIcon,
  brokerage: TrendsIcon,
  retirement: ShieldIcon,
  manualAsset: BoxIcon,
};

export function AccountTypeIcon({
  type,
  className,
}: {
  type: AccountType;
  className?: string;
}) {
  const Icon = TYPE_ICONS[type] ?? BoxIcon;
  return <Icon className={className} />;
}

/* ------------------------------------------------- connection badge ------ */

const TONE_CLASSES: Record<ConnectionTone, string> = {
  demo: "border-warning/40 bg-warning-soft text-warning",
  manual: "border-line-strong bg-surface-raised text-ink-muted",
  connected: "border-brand-600/35 bg-brand-100 text-brand-800 dark:bg-brand-100/40 dark:text-brand-900",
  stale: "border-warning/40 bg-warning-soft text-warning",
  reconnect: "border-danger/40 bg-danger-soft text-danger",
  unsupported: "border-line-strong bg-surface-sunken text-ink-muted",
  disconnected: "border-line-strong bg-surface-sunken text-ink-faint",
};

/** Honest connection-state badge for an account. */
export function ConnectionBadge({
  status,
  className,
}: {
  status: ConnectionStatus;
  className?: string;
}) {
  const meta = CONNECTION_META[status];
  return (
    <span
      title={meta.description}
      className={cn(
        "inline-flex items-center rounded-pill border px-2.5 py-0.5 text-caption font-semibold",
        TONE_CLASSES[meta.tone],
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

/** "Source: Demo · Updated Sep 10, 2026, 8:30 AM" caption. */
export function SourceTimeCaption({
  source,
  updatedAt,
}: {
  source: "demo" | "manual" | "imported";
  updatedAt?: string;
}) {
  return (
    <p className="text-caption text-ink-faint">
      Source: {sourceLabel(source)}
      {updatedAt ? ` · Updated ${formatDateTime(updatedAt)}` : ""}
    </p>
  );
}

/* ------------------------------------------------ transaction chips ------ */

export function StatusChip({ status }: { status: Transaction["status"] }) {
  return status === "pending" ? (
    <span className="inline-flex items-center rounded-pill bg-warning-soft px-2 py-0.5 text-caption font-semibold text-warning dark:bg-warning/15">
      Pending
    </span>
  ) : (
    <span className="inline-flex items-center rounded-pill bg-surface-sunken px-2 py-0.5 text-caption font-medium text-ink-faint">
      Posted
    </span>
  );
}

export function KindChip({ kind }: { kind: Transaction["kind"] }) {
  if (kind === "transfer") {
    return (
      <span className="inline-flex items-center rounded-pill border border-brand-600/35 bg-brand-100 px-2 py-0.5 text-caption font-semibold text-brand-800 dark:bg-brand-100/40 dark:text-brand-900">
        Transfer
      </span>
    );
  }
  if (kind === "loanPayment") {
    return (
      <span className="inline-flex items-center rounded-pill border border-line-strong bg-surface-sunken px-2 py-0.5 text-caption font-semibold text-ink-muted">
        Loan payment
      </span>
    );
  }
  return null;
}

export function ExcludedChip({ label = "Excluded" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-pill bg-surface-sunken px-2 py-0.5 text-caption font-semibold text-ink-faint">
      {label}
    </span>
  );
}

export function UncategorizedChip() {
  return (
    <span className="inline-flex items-center rounded-pill border border-dashed border-line-strong px-2 py-0.5 text-caption font-medium text-ink-faint">
      Uncategorized
    </span>
  );
}

export function SourceChipSmall({ source }: { source: Transaction["source"] }) {
  return (
    <span className="inline-flex items-center rounded-pill bg-surface-sunken px-2 py-0.5 text-caption font-medium text-ink-faint">
      {sourceLabel(source)}
    </span>
  );
}

/** Small label like "Checking" beneath account names. */
export function TypeCaption({ type }: { type: AccountType }) {
  return <span className="text-caption text-ink-faint">{ACCOUNT_TYPE_LABELS[type]}</span>;
}

/* ------------------------------------------------ section header ------- */

export function SectionHeader({
  title,
  detail,
  actions,
}: {
  title: string;
  detail?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-h2 text-ink">{title}</h2>
        {detail ? <p className="mt-0.5 text-body-sm text-ink-muted">{detail}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}