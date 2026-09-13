import { useMemo, useState } from "react";
import type { Transaction } from "~/lib/finance/types";
import {
  balanceView,
  CONNECTION_META,
  institutionLabel,
  isInvestmentAccount,
  needsReconnectBanner,
  canSimulateReconnect,
  formatDate,
} from "~/lib/accounts/accounts";
import { CATEGORY_GROUPS } from "~/lib/accounts/categories";
import { findDuplicateFlags, type DuplicateFlag } from "~/lib/accounts/duplicates";
import { summarizeExpenses } from "~/lib/finance/transactions";
import { useClientData } from "~/lib/client/store";
import type { Household } from "~/lib/client/types";
import { Card } from "~/components/Card";
import { Banner } from "~/components/Banner";
import { Button } from "~/components/Button";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { Modal, Sheet } from "~/components/Dialog";
import { Money } from "~/components/Money";
import { Select } from "~/components/Select";
import { TextField } from "~/components/TextField";
import { Switch } from "~/components/Switch";
import { formatDollars } from "~/lib/money";
import { cn } from "~/lib/cn";
import {
  ArrowLeftIcon,
  RefreshIcon,
  SearchIcon,
  TrashIcon,
  WarningIcon,
} from "~/components/icons";
import {
  AccountTypeIcon,
  ConnectionBadge,
  ExcludedChip,
  KindChip,
  SourceChipSmall,
  SourceTimeCaption,
  StatusChip,
  TypeCaption,
} from "./bits";

export const ALL_ACCOUNTS = "__all__";

function accountSort(a: Transaction, b: Transaction): number {
  return (
    b.transactedAt.localeCompare(a.transactedAt) ||
    (b.postedAt ?? "").localeCompare(a.postedAt ?? "") ||
    b.id.localeCompare(a.id)
  );
}

function isMoneyOut(t: Transaction): boolean {
  return t.amountCents < 0;
}

/* -------------------------------------------------- transaction row ------ */

function TransactionRow({
  txn,
  category,
  onClick,
}: {
  txn: Transaction;
  category?: string;
  onClick: () => void;
}) {
  const out = isMoneyOut(txn);
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-label={`Open transaction: ${txn.merchant}, ${formatDollars(txn.amountCents)}`}
        className={cn(
          "flex w-full items-center gap-3 px-1.5 py-2.5 text-left transition-colors hover:bg-surface-sunken",
          txn.isExcluded && "opacity-55",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="truncate text-body-sm font-semibold text-ink">
              {txn.merchant}
            </span>
            <StatusChip status={txn.status} />
            <KindChip kind={txn.kind} />
            {txn.duplicateOf ? <ExcludedChip label="Duplicate" /> : null}
            {txn.isExcluded && !txn.duplicateOf ? <ExcludedChip /> : null}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-caption text-ink-faint">
            <span>{formatDate(txn.transactedAt)}</span>
            <span aria-hidden="true">·</span>
            <span>{category ?? txn.category}</span>
            <SourceChipSmall source={txn.source} />
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 text-num tabular-nums",
            txn.isExcluded
              ? "text-ink-faint"
              : out
                ? txn.kind === "expense"
                  ? "text-ink"
                  : "text-ink-muted"
                : "text-success dark:text-accent-700",
          )}
        >
          <Money cents={txn.amountCents} options={{ signed: true }} />
        </span>
      </button>
    </li>
  );
}

/* ---------------------------------------------- transaction detail ------ */

function TransactionDetailSheet({
  txn,
  accountName,
  duplicateFlag,
  onClose,
}: {
  txn: Transaction;
  accountName: string;
  duplicateFlag: DuplicateFlag | null;
  onClose: () => void;
}) {
  const store = useClientData();
  const out = isMoneyOut(txn);
  const categoryOptions = CATEGORY_GROUPS.flatMap((g) => [
    <optgroup key={g.label} label={g.label}>
      {g.categories.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </optgroup>,
  ]);
  const hasCustomCategory =
    txn.category && !CATEGORY_GROUPS.flatMap((g) => g.categories).includes(txn.category);
  const canChangeKind = txn.source !== "demo";
  const flagged = duplicateFlag !== null && !txn.duplicateOf;

  return (
    <Sheet open onClose={onClose} title="Transaction">
      <div className="flex flex-col gap-4">
        {/* amount header */}
        <div className="flex flex-col gap-1">
          <p className="text-body-sm font-semibold text-ink">{txn.merchant}</p>
          <p className="text-caption text-ink-muted">{accountName}</p>
          <Money
            cents={txn.amountCents}
            options={{ signed: true }}
            className={cn(
              "text-num-xl",
              txn.isExcluded
                ? "text-ink-faint"
                : out
                  ? "text-ink"
                  : "text-success dark:text-accent-700",
            )}
          />
        </div>

        {/* facts */}
        <div className="flex flex-wrap gap-1.5">
          <StatusChip status={txn.status} />
          <KindChip kind={txn.kind} />
          <SourceChipSmall source={txn.source} />
          {txn.isExcluded ? <ExcludedChip label={txn.duplicateOf ? "Duplicate" : "Excluded"} /> : null}
        </div>

        <dl className="grid grid-cols-1 gap-2 rounded-card border border-line-faint bg-surface-sunken/60 p-3.5 text-body-sm sm:grid-cols-2">
          <div>
            <dt className="text-caption text-ink-faint">Date</dt>
            <dd className="text-ink">{formatDate(txn.transactedAt)}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-faint">Posted</dt>
            <dd className="text-ink">
              {txn.postedAt ? formatDate(txn.postedAt) : "Pending — not yet posted"}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-faint">Category</dt>
            <dd className="text-ink">{txn.category || "Uncategorized"}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-faint">Source</dt>
            <dd className="text-ink">
              {txn.source === "demo"
                ? "Synthetic demo data"
                : txn.source === "imported"
                  ? "Imported from CSV — labeled Imported, never Connected"
                  : "Entered by hand"}
            </dd>
          </div>
        </dl>

        {/* loan payment split — one event, never double-counted */}
        {txn.kind === "loanPayment" &&
        txn.principalCents !== null &&
        txn.interestCents !== null ? (
          <p className="text-body-sm text-ink-muted">
            Principal <Money cents={txn.principalCents} className="font-semibold text-ink" /> · Interest{" "}
            <Money cents={txn.interestCents} className="font-semibold text-ink" /> — the payment counts
            once in spending.
          </p>
        ) : null}
        {txn.kind === "transfer" ? (
          <p className="text-body-sm text-ink-muted">
            Transfer — money moved between accounts. It is labeled and never counted as spending.
          </p>
        ) : null}

        {/* category correction */}
        <div>
          <Select
            label="Category"
            value={txn.category || "uncategorized"}
            onChange={(e) => store.setTransactionCategory(txn.id, e.target.value)}
          >
            <option value="uncategorized">Uncategorized</option>
            {categoryOptions}
            {hasCustomCategory && txn.category ? (
              <option value={txn.category}>{txn.category} (current)</option>
            ) : null}
          </Select>
          <p className="mt-1 text-caption text-ink-faint">
            Corrections only change this transaction's label — nothing is sent anywhere.
          </p>
        </div>

        {/* actions */}
        <div className="flex flex-col gap-3 border-t border-line-faint pt-3">
          <Switch
            checked={txn.isExcluded}
            onChange={(v) => store.setTransactionExcluded(txn.id, v)}
            label="Exclude from spending and income totals"
          />

          {txn.status === "pending" ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => store.markTransactionPosted(txn.id)}
            >
              Mark as posted (demo reconciliation)
            </Button>
          ) : null}

          {canChangeKind && txn.kind === "expense" ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => store.markTransactionTransfer(txn.id)}
            >
              Mark as transfer (not spending)
            </Button>
          ) : null}

          {flagged && duplicateFlag ? (
            <div className="rounded-card border border-warning/40 bg-warning-soft p-3">
              <p className="flex items-start gap-2 text-body-sm font-medium text-warning">
                <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
                Possible duplicate
              </p>
              <p className="mt-1 text-body-sm text-ink-muted">{duplicateFlag.reason}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => store.setTransactionDuplicate(txn.id, duplicateFlag.ofTxnId)}
                >
                  Mark as duplicate
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => store.setDuplicateIgnored(txn.id, true)}
                >
                  Keep — not a duplicate
                </Button>
              </div>
            </div>
          ) : null}

          {txn.duplicateOf ? (
            <p className="text-body-sm text-ink-muted">
              Recorded as a duplicate of another entry and kept out of totals.
              <button
                type="button"
                className="ml-1 font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-500"
                onClick={() => store.setTransactionDuplicate(txn.id, null)}
              >
                Not a duplicate — restore
              </button>
            </p>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}

/* -------------------------------------------------------- the view ------ */

export function TransactionsView({
  household,
  selectedAccountId,
  onSelectAccount,
  onBack,
  onAddTransaction,
}: {
  household: Household;
  selectedAccountId: string;
  onSelectAccount: (id: string) => void;
  onBack: () => void;
  onAddTransaction: () => void;
}) {
  const store = useClientData();
  const account =
    selectedAccountId === ALL_ACCOUNTS
      ? null
      : (household.accounts.find((a) => a.id === selectedAccountId) ?? null);

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("__all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "posted">("all");
  const [openTxnId, setOpenTxnId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reconnectOpen, setReconnectOpen] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return household.transactions
      .filter((t) => {
        if (account && t.accountId !== account.id) return false;
        if (statusFilter !== "all" && t.status !== statusFilter) return false;
        if (categoryFilter !== "__all" && t.category !== categoryFilter) return false;
        if (q) {
          const hay = `${t.merchant} ${t.description ?? ""} ${t.category}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort(accountSort);
  }, [household.transactions, account, query, categoryFilter, statusFilter]);

  const categoriesHere = useMemo(() => {
    const set = new Set<string>();
    const base = account
      ? household.transactions.filter((t) => t.accountId === account.id)
      : household.transactions;
    for (const t of base) set.add(t.category || "uncategorized");
    return [...set].sort();
  }, [household.transactions, account]);

  const dupFlags = useMemo(
    () => (account ? findDuplicateFlags(household.transactions) : []),
    [household.transactions, account],
  );

  const accountSummary = useMemo(() => {
    if (!account) return null;
    const txns = household.transactions.filter((t) => t.accountId === account.id);
    return summarizeExpenses(txns);
  }, [household.transactions, account]);

  const openTxn = openTxnId
    ? (household.transactions.find((t) => t.id === openTxnId) ?? null)
    : null;
  const openTxnFlag = openTxn ? (dupFlags.find((f) => f.txnId === openTxn.id) ?? null) : null;
  const accountName = (id: string) =>
    household.accounts.find((a) => a.id === id)?.name ??
    (account?.id === id ? account.name : "Unknown");

  const view = account ? balanceView(account) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* header */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to accounts"
          className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-control text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-h1 text-ink">{account ? account.name : "All transactions"}</h1>
          {account ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-body-sm text-ink-muted">{institutionLabel(account)}</span>
              <ConnectionBadge status={account.connectionStatus} />
              <TypeCaption type={account.type} />
            </div>
          ) : (
            <p className="text-body-sm text-ink-muted">
              Every transaction across your {household.accounts.length}{" "}
              {household.accounts.length === 1 ? "account" : "accounts"}.
            </p>
          )}
        </div>
        <Button size="sm" onClick={onAddTransaction}>
          Add transaction
        </Button>
      </div>

      {/* account facts */}
      {account ? (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="grid h-10 w-10 place-items-center rounded-control bg-brand-100 text-brand-800 dark:bg-brand-100/40 dark:text-brand-900"
              >
                <AccountTypeIcon type={account.type} className="h-5 w-5" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {view ? (
                    <>
                      <span className="flex items-baseline gap-1.5">
                        <span className="text-caption text-ink-faint">{view.primary.label}</span>
                        {view.primary.cents === null ? (
                          <span className="text-num-lg text-ink-faint">Unknown</span>
                        ) : (
                          <Money cents={view.primary.cents} className="text-num-lg text-ink" />
                        )}
                        {view.primary.note ? (
                          <span className="text-caption text-ink-muted">{view.primary.note}</span>
                        ) : null}
                      </span>
                      {view.lines.map((line) => (
                        <span key={line.label} className="flex items-baseline gap-1.5">
                          <span className="text-caption text-ink-faint">{line.label}</span>
                          {line.cents === null ? (
                            <span className="text-body-sm text-ink-faint">Unknown</span>
                          ) : (
                            <Money cents={line.cents} className="text-body-sm font-semibold text-ink" />
                          )}
                        </span>
                      ))}
                    </>
                  ) : null}
                </div>
                {isInvestmentAccount(account) ? (
                  <p className="mt-1 text-caption font-semibold text-ink-muted">
                    Investments — not spendable cash.
                  </p>
                ) : null}
                <div className="mt-1.5">
                  <SourceTimeCaption source={account.source} updatedAt={account.updatedAt} />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canSimulateReconnect(account) ? (
                <Button variant="secondary" size="sm" onClick={() => setReconnectOpen(true)}>
                  <RefreshIcon className="h-4 w-4" />
                  {account.connectionStatus === "connected" ? "Manage connection" : "Reconnect"}
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>
                <TrashIcon className="h-4 w-4" />
                Delete account
              </Button>
            </div>
          </div>

          {/* stale / disconnected banner */}
          {needsReconnectBanner(account.connectionStatus) ? (
            <div className="mt-4">
              <Banner
                variant={account.connectionStatus === "unsupported" ? "info" : "stale"}
                title={CONNECTION_META[account.connectionStatus].label}
                description={CONNECTION_META[account.connectionStatus].description}
                action={
                  canSimulateReconnect(account) ? (
                    <Button size="sm" onClick={() => setReconnectOpen(true)}>
                      <RefreshIcon className="h-4 w-4" />
                      Reconnect (simulated)
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : null}

          {/* summary */}
          {accountSummary ? (
            <div className="mt-4 border-t border-line-faint pt-3">
              <p className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-faint">
                This account, all rows
              </p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-body-sm">
                <span className="text-ink-muted">
                  Spending <Money cents={accountSummary.spendEventCents} className="font-semibold text-ink" />
                </span>
                <span className="text-ink-muted">
                  Transfers <Money cents={accountSummary.transferCents} className="font-semibold text-ink" />
                </span>
                <span className="text-ink-muted">
                  Income <Money cents={accountSummary.incomeCents} className="font-semibold text-ink" />
                </span>
                {accountSummary.excludedCents > 0 ? (
                  <span className="text-ink-faint">
                    Excluded <Money cents={accountSummary.excludedCents} className="font-semibold text-ink-faint" />
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-caption text-ink-faint">
                A card purchase counts once as spending; the later payment is a transfer, never a
                second spending event.
              </p>
              <p className="mt-1 text-caption text-ink-faint">
                The balance above is what was reported — adding or editing transactions here does
                not change it.
              </p>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* filters */}
      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <TextField
            label="Search"
            value={query}
            onChange={setQuery}
            placeholder="Merchant, memo, or category"
            suffix={<SearchIcon className="h-4 w-4 text-ink-faint" />}
          />
          <Select
            label="Account"
            value={selectedAccountId}
            onChange={(e) => onSelectAccount(e.target.value)}
          >
            <option value={ALL_ACCOUNTS}>All accounts</option>
            {household.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-2.5">
            <Select
              label="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="__all">All categories</option>
              {categoriesHere.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | "pending" | "posted")
              }
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="posted">Posted</option>
            </Select>
          </div>
        </div>
      </div>

      {/* duplicate review */}
      {dupFlags.length > 0 ? (
        <Card className="border-warning/40 bg-warning-soft/40">
          <p className="flex items-center gap-2 text-body-sm font-semibold text-ink">
            <WarningIcon className="h-4 w-4 text-warning" />
            Possible duplicates to review ({dupFlags.length})
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {dupFlags.map((f) => {
              const txn = household.transactions.find((t) => t.id === f.txnId);
              if (!txn) return null;
              return (
                <li
                  key={f.txnId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line-faint bg-surface-raised px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-medium text-ink">{txn.merchant}</p>
                    <p className="text-caption text-ink-muted">{f.reason}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      onClick={() => store.setTransactionDuplicate(txn.id, f.ofTxnId)}
                    >
                      Mark duplicate
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => store.setDuplicateIgnored(txn.id, true)}
                    >
                      Keep
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-caption text-ink-faint">
            Detection only suggests; you decide. “Mark duplicate” keeps the older entry and
            excludes this one from totals.
          </p>
        </Card>
      ) : null}

      {/* list */}
      {visible.length === 0 ? (
        <Card>
          <p className="text-body-sm text-ink-muted">
            {household.transactions.length === 0
              ? "No transactions yet for " + (account ? account.name : "your household") + "."
              : "No transactions match these filters."}
          </p>
          {household.transactions.length === 0 ? (
            <p className="mt-1 text-caption text-ink-faint">
              Add one manually or import a CSV — everything is stored on this device only.
            </p>
          ) : null}
        </Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-line-faint px-2.5 py-1.5">
            {visible.map((t) => (
              <TransactionRow
                key={t.id}
                txn={t}
                onClick={() => setOpenTxnId(t.id)}
              />
            ))}
          </ul>
        </Card>
      )}

      {/* dialogs */}
      {openTxn ? (
        <TransactionDetailSheet
          txn={openTxn}
          accountName={accountName(openTxn.accountId)}
          duplicateFlag={openTxnFlag}
          onClose={() => setOpenTxnId(null)}
        />
      ) : null}

      {account ? (
        <ConfirmDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          title={`Delete ${account.name}?`}
          body={
            <>
              <p>
                This removes the account record and its transactions from this prototype on this
                device. It does not touch any real institution — nothing here is connected to a
                bank — and nothing is sent anywhere.
              </p>
              <p className="mt-2 text-caption text-ink-faint">
                Prototype scope: all data is synthetic or entered by hand, and deleting it is
                permanent for this device.
              </p>
            </>
          }
          confirmLabel="Delete account"
          onConfirm={() => {
            store.deleteAccount(account.id);
            setDeleteOpen(false);
            onBack();
          }}
        />
      ) : null}

      <Modal
        open={reconnectOpen}
        onClose={() => setReconnectOpen(false)}
        title={account ? `Connection: ${account.name}` : "Connection"}
      >
        {account ? (
          <div className="flex flex-col gap-3">
            <p className="text-body text-ink-muted">
              {CONNECTION_META[account.connectionStatus].description}
            </p>
            <p className="text-body-sm text-ink-muted">
              There is no real connection in this prototype. “Reconnect” is a simulation: it
              changes this record's status so you can explore what a healthy connection would look
              like. No institution is contacted and no data is fetched.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setReconnectOpen(false)}>
                Keep as is
              </Button>
              <Button
                onClick={() => {
                  store.setAccountConnectionStatus(account.id, "connected");
                  setReconnectOpen(false);
                }}
              >
                <RefreshIcon className="h-4 w-4" />
                Reconnect (simulated)
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}