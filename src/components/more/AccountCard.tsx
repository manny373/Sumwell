import type { Account } from "~/lib/finance/types";
import { balanceView, institutionLabel, isInvestmentAccount } from "~/lib/accounts/accounts";
import { Card } from "~/components/Card";
import { Money } from "~/components/Money";
import { ChevronRightIcon } from "~/components/icons";
import {
  AccountTypeIcon,
  ConnectionBadge,
  SourceTimeCaption,
  TypeCaption,
} from "./bits";
import { cn } from "~/lib/cn";

function BalanceValue({ cents }: { cents: number | null }) {
  if (cents === null) {
    return (
      <span className="text-num text-ink-faint" aria-label="Unknown">
        Unknown
      </span>
    );
  }
  return <Money cents={cents} className="text-num-lg text-ink" />;
}

/**
 * One account card: name, synthetic institution, type icon, truthful balance
 * lines (current vs available where they differ, available credit for cards),
 * the connection-state badge with source + last-updated time, and an explicit
 * "not spendable cash" label on retirement/investment accounts.
 */
export function AccountCard({
  account,
  onOpen,
}: {
  account: Account;
  onOpen: () => void;
}) {
  const view = balanceView(account);
  const investment = isInvestmentAccount(account);
  return (
    <Card interactive padded={false} className="overflow-hidden">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${account.name}`}
        className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-surface-sunken"
      >
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-brand-100 text-brand-800 dark:bg-brand-100/40 dark:text-brand-900"
        >
          <AccountTypeIcon type={account.type} className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate text-body font-semibold text-ink">{account.name}</span>
            <TypeCaption type={account.type} />
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate text-caption text-ink-muted">
              {institutionLabel(account)}
            </span>
            <ConnectionBadge status={account.connectionStatus} />
          </span>
          {investment ? (
            <span className="mt-1 inline-flex items-center rounded-pill bg-surface-sunken px-2 py-0.5 text-caption font-semibold text-ink-muted">
              Investments — not spendable cash
            </span>
          ) : null}
          <span className="mt-1.5 block">
            <SourceTimeCaption source={account.source} updatedAt={account.updatedAt} />
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span
            className={cn(
              "flex flex-col items-end gap-0.5",
              view.isDebt && "text-ink-muted",
            )}
          >
            <BalanceValue cents={view.primary.cents} />
            <span className="text-caption text-ink-faint">
              {view.primary.note ?? view.primary.label}
            </span>
            {view.lines.map((line) => (
              <span key={line.label} className="flex items-baseline gap-1.5">
                <span className="text-caption text-ink-faint">{line.label}</span>
                <Money cents={line.cents!} className="text-caption font-semibold text-ink-muted" />
              </span>
            ))}
          </span>
        </span>
        <ChevronRightIcon className="h-4.5 w-4.5 shrink-0 text-ink-faint" />
      </button>
    </Card>
  );
}