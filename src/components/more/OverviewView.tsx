import { useMemo } from "react";
import { Card } from "~/components/Card";
import { Money } from "~/components/Money";
import { ArrowLeftIcon, ChevronRightIcon, InfoIcon, WarningIcon } from "~/components/icons";
import { allYourMoneyView, type AllYourMoneyView, type LiabilityRow } from "~/lib/client/overview";
import type { Household } from "~/lib/client/types";
import { cn } from "~/lib/cn";

function UnknownValue({ className }: { className?: string }) {
  return <span className={cn("text-num text-ink-faint", className)}>Unknown</span>;
}

/** Net worth headline — exact or Unknown, never an invented 0 (Finding 10). */
function NetWorthCard({ view }: { view: AllYourMoneyView }) {
  const net = view.netWorthCents;
  return (
    <Card className={cn("border-brand-200/60 bg-brand-50/60 dark:bg-brand-100/20")}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-faint">
            Net worth
          </p>
          {net === null ? (
            <p className="mt-1.5 text-num-xl text-ink-faint">Unknown</p>
          ) : (
            <Money
              cents={net}
              className={cn(
                "mt-1.5 block text-num-xl tabular-nums",
                net < 0 ? "text-danger" : "text-ink",
              )}
            />
          )}
          <p className="mt-1 text-caption text-ink-muted">
            {view.assetsTotalCents === null
              ? "Some account balances are unknown, so net worth can't be totaled — never guessed."
              : "Assets you own minus what you owe. Estimates from the records below."}
          </p>
        </div>
        <dl className="flex flex-col gap-1 text-body-sm">
          <div className="flex items-baseline justify-between gap-6">
            <dt className="text-ink-muted">Assets</dt>
            <dd className="text-num text-ink">
              {view.assetsTotalCents === null ? (
                <UnknownValue />
              ) : (
                <Money cents={view.assetsTotalCents} />
              )}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-6">
            <dt className="text-ink-muted">Debts</dt>
            <dd className="text-num text-danger">
              <Money cents={view.liabilitiesTotalCents} />
            </dd>
          </div>
          {view.availableCreditCents !== null ? (
            <div className="flex items-baseline justify-between gap-6">
              <dt className="text-ink-muted">Available credit (cards)</dt>
              <dd className="text-num text-ink">
                <Money cents={view.availableCreditCents} />
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
      {view.availableCreditCents !== null ? (
        <p className="mt-2 flex items-start gap-1.5 border-t border-line-faint pt-2 text-caption text-ink-muted">
          <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Available credit on cards is separate from balances you owe — it is
          spending room, not money you have.
        </p>
      ) : null}
    </Card>
  );
}

function AssetGroupCard({ group }: { group: AllYourMoneyView["assetGroups"][number] }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body font-semibold text-ink">{group.label}</p>
          <p className="text-caption text-ink-muted">{group.note}</p>
        </div>
        <p className="shrink-0 text-num text-ink">
          {group.totalCents === null ? <UnknownValue /> : <Money cents={group.totalCents} />}
        </p>
      </div>
      <ul className="mt-2 divide-y divide-line-faint rounded-control border border-line-faint bg-surface-sunken/40 px-3.5">
        {group.lines.map((line) => (
          <li key={line.accountId} className="flex items-baseline justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block truncate text-body-sm text-ink">{line.name}</span>
              {line.note ? (
                <span className="block text-caption text-ink-muted">{line.note}</span>
              ) : null}
            </span>
            <span className="shrink-0">
              {line.cents === null ? (
                <UnknownValue />
              ) : (
                <Money cents={line.cents} className="text-body-sm font-semibold text-ink" />
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LiabilityRow({ row, onOpenAccount }: { row: LiabilityRow; onOpenAccount: (accountId: string) => void }) {
  const paidOff = row.note?.includes("Paid off");
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className="block truncate text-body-sm font-medium text-ink">{row.name}</span>
        <span className="block text-caption text-ink-muted">
          {row.accountId ? (
            paidOff ? (
              "Paid off — zero balance on record"
            ) : (
              "Tracked on an account — inspectable below"
            )
          ) : (
            "Tracked as debt — no account record"
          )}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {paidOff ? null : (
          <Money cents={row.cents} className="text-num text-ink" />
        )}
        {row.accountId ? (
          <button
            type="button"
            onClick={() => onOpenAccount(row.accountId!)}
            aria-label={`Open ${row.name} account`}
            className="grid h-8 w-8 place-items-center rounded-control text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <ChevronRightIcon className="h-4.5 w-4.5" />
          </button>
        ) : null}
      </span>
    </li>
  );
}

/**
 * All-your-money — the consolidated assets / debts / net worth view built
 * from the canonical household records (accounts + debts, identity via
 * accountId). Reachable from the More tab and from Home. Missing values are
 * "Unknown", never 0; retirement/investment is labeled NOT spendable cash;
 * available credit is shown separately; every debt is inspectable.
 */
export function OverviewView({
  household,
  onBack,
  onOpenAccount,
}: {
  household: Household;
  onBack: () => void;
  onOpenAccount: (accountId: string) => void;
}) {
  const view = useMemo(() => allYourMoneyView(household), [household]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to More"
            className="grid h-9 w-9 place-items-center rounded-control text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <h1 className="text-h1 text-ink">All your money</h1>
        </div>
      </header>
      <p className="-mt-2 text-body-sm text-ink-muted">
        Assets, debts, and net worth — one view from the same records Plan and
        Home use, so nothing is counted twice.
      </p>

      <NetWorthCard view={view} />

      {view.unlinkedDebts.length > 0 ? (
        <div className="rounded-control bg-warning-soft px-3.5 py-2.5 text-caption leading-relaxed text-warning">
          <span className="font-semibold">Some debts lack an account record</span> — they are
          included above and labeled, but they can't be opened from the accounts list.
        </div>
      ) : null}

      {view.assetGroups.length > 0 ? (
        <section aria-labelledby="overview-assets">
          <p
            id="overview-assets"
            className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-faint"
          >
            Assets
          </p>
          <div className="mt-2 flex flex-col gap-4">
            {view.assetGroups.map((g) => (
              <AssetGroupCard key={g.id} group={g} />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="overview-debts">
        <p
          id="overview-debts"
          className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-faint"
        >
          Debts
        </p>
        <Card className="mt-2">
          <ul className="divide-y divide-line-faint">
            {view.liabilities.map((row) => (
              <LiabilityRow key={row.debtId} row={row} onOpenAccount={onOpenAccount} />
            ))}
            {view.unlinkedDebts.map((row) => (
              <LiabilityRow
                key={`unlinked-${row.debtId}`}
                row={{ ...row, note: "Account record only — no matching debt strategy entry" }}
                onOpenAccount={onOpenAccount}
              />
            ))}
          </ul>
          <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-line pt-3">
            <p className="text-body-sm font-semibold text-ink">Debts total</p>
            <Money cents={view.liabilitiesTotalCents} className="text-num-lg text-ink" />
          </div>
          <p className="mt-1 text-caption leading-relaxed text-ink-muted">
            Numbered from the debt records the Plan tab uses — amounts match the
            account balances they link to.
          </p>
        </Card>
      </section>

      {view.unknownAccounts.length > 0 ? (
        <p className="flex items-start gap-1.5 text-caption leading-relaxed text-ink-muted">
          <WarningIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          {view.unknownAccounts.map((a) => a.name).join(", ")}{" "}
          {view.unknownAccounts.length === 1 ? "has" : "have"} an unknown balance —
          shown as Unknown, never as 0.
        </p>
      ) : null}

      <p className="flex items-start gap-1.5 text-caption leading-relaxed text-ink-muted">
        <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {view.allDebtsInspectable
          ? "Every debt links to an account record, so each one is inspectable in Accounts."
          : "Some debts have no linked account record — they are still listed above."}{" "}
        Numbers are estimates from the records on this device.
      </p>
    </div>
  );
}