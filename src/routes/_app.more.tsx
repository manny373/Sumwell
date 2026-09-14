import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card } from "~/components/Card";
import { Banner } from "~/components/Banner";
import { Button, buttonClass } from "~/components/Button";
import { Skeleton } from "~/components/LoadingState";
import { Money } from "~/components/Money";
import { useClientData } from "~/lib/client/store";
import { buildHomePlan } from "~/lib/client/plan";
import { allYourMoneyView } from "~/lib/client/overview";
import { todayISO } from "~/lib/client/dates";
import { formatCents } from "~/lib/money";
import { SourceTimeCaption } from "~/components/more/bits";
import { AccountCard } from "~/components/more/AccountCard";
import { ALL_ACCOUNTS, TransactionsView } from "~/components/more/TransactionsView";
import { OverviewView } from "~/components/more/OverviewView";
import { AddAccountSheet, AddTransactionSheet } from "~/components/more/FormsSheets";
import { ImportSheet } from "~/components/more/ImportSheet";
import { ExportSheet } from "~/components/more/ExportSheet";
import { MoreSections, type MoreSectionId } from "~/components/more/MoreSections";
import { CreditView } from "~/components/more/sections/CreditView";
import { DiscoverView } from "~/components/more/sections/DiscoverView";
import { SupportView } from "~/components/more/sections/SupportView";
import { PrivacyView } from "~/components/more/sections/PrivacyView";
import { SettingsView } from "~/components/more/sections/SettingsView";
import {
  ChevronRightIcon,
  DownloadIcon,
  PlusIcon,
  UploadIcon,
  WalletIcon,
} from "~/components/icons";
import { cn } from "~/lib/cn";

export const Route = createFileRoute("/_app/more")({
  /**
   * Search param support so Home can deep-link to the All-your-money overview
   * (Finding 10). Internal view state is synced to the URL below.
   */
  validateSearch: (search: Record<string, unknown>) => ({
    view: search.view === "overview" ? ("overview" as const) : undefined,
  }),
  component: MoreRoute,
});

type View =
  | { kind: "accounts" }
  | { kind: "overview" }
  | { kind: "transactions"; accountId: string }
  | { kind: "section"; section: MoreSectionId };

function MoreRoute() {
  const { status, onboarded, loadError, household, startOver } = useClientData();
  const navigate = useNavigate();
  const routeSearch = Route.useSearch();
  const [view, setView] = useState<View>(
    routeSearch.view === "overview" ? { kind: "overview" } : { kind: "accounts" },
  );
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [addTxnTarget, setAddTxnTarget] = useState<string | null>(null);
  const [sheetNonce, setSheetNonce] = useState(0);

  // Keep the ?view=overview search param in sync with the internal view state
  // so a refresh stays on the same screen and Home's deep link works once.
  const setViewAndSearch = (next: View) => {
    setView(next);
    void navigate({
      to: "/more",
      search: next.kind === "overview" ? { view: "overview" } : { view: undefined },
      replace: true,
    });
  };

  const openAddTxn = (accountId: string | null) => {
    setAddTxnTarget(accountId);
    setSheetNonce((n) => n + 1);
  };

  if (status !== "ready" || !household) {
    // Loading skeleton (the shell normally gates on ready; belt-and-braces).
    if (!onboarded && status === "ready") {
      return <Card>No household yet — <Link to="/setup" className="font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-500">set up your numbers</Link>.</Card>;
    }
    return (
      <div className="flex flex-col gap-4" aria-hidden="true">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <span className="sr-only">Loading accounts…</span>
      </div>
    );
  }

  const now = todayISO();
  const planCtx = buildHomePlan(household, now);
  const planStale = planCtx.reason === "stale";
  const overview = allYourMoneyView(household);

  return (
    <div className="flex flex-col gap-6">
      {view.kind === "accounts" ? (
        <div className="flex flex-col gap-4">
          {/* header */}
          <header>
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-h1 text-ink">More</h1>
              {household ? (
                <SourceTimeCaption source={household.source} updatedAt={household.generatedAt} />
              ) : null}
            </div>
            <p className="mt-1 text-body-sm text-ink-muted">
              Accounts, transactions, and everything else — all synthetic or entered by hand.
            </p>
          </header>

          {/* honest states */}
          {loadError ? (
            <Banner
              variant="error"
              title="We couldn't read your saved data"
              description="The data on this device didn't load (it may be from an older version or incomplete). Nothing is lost anywhere else — this prototype only stores data on this device."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    startOver();
                    void navigate({ to: "/" });
                  }}
                >
                  Start over
                </Button>
              }
            />
          ) : null}

          {planStale ? (
            <Banner
              variant="stale"
              title="These numbers are out of date"
              description={`The next paycheck modeled in this household has already passed, so plans built from it would be guesswork. You can still review accounts and transactions below.`}
            />
          ) : null}

          {/* all your money — consolidated assets/debts/net worth (Finding 10) */}
          <Card interactive padded={false} className="overflow-hidden">
            <button
              type="button"
              onClick={() => setViewAndSearch({ kind: "overview" })}
              className="flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-surface-sunken"
            >
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-brand-100 text-brand-800 dark:bg-brand-100/40 dark:text-brand-900"
              >
                <WalletIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body font-semibold text-ink">All your money</span>
                <span className="mt-0.5 block text-body-sm text-ink-muted">
                  Assets, debts, and net worth from one set of records
                </span>
              </span>
              {overview.netWorthCents !== null ? (
                <Money
                  cents={overview.netWorthCents}
                  className={cn(
                    "shrink-0 text-num-lg",
                    overview.netWorthCents < 0 ? "text-danger" : "text-ink",
                  )}
                />
              ) : (
                <span className="shrink-0 text-num text-ink-faint">Unknown</span>
              )}
              <ChevronRightIcon className="h-4.5 w-4.5 shrink-0 text-ink-faint" />
            </button>
          </Card>

          {/* actions */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => { setAddAccountOpen(true); setSheetNonce((n) => n + 1); }}>
              <PlusIcon className="h-4 w-4" />
              Add account
            </Button>
            <Button variant="secondary" size="sm" onClick={() => openAddTxn(household.accounts.some((a) => a.type === "checking") ? (household.accounts.find((a) => a.type === "checking")?.id ?? null) : null)}>
              <PlusIcon className="h-4 w-4" />
              Add transaction
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
              <UploadIcon className="h-4 w-4" />
              Import CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setExportOpen(true)}>
              <DownloadIcon className="h-4 w-4" />
              Export
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setViewAndSearch({ kind: "transactions", accountId: ALL_ACCOUNTS })}>
              All transactions
            </Button>
          </div>

          {/* accounts list */}
          {household.accounts.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-100 text-brand-800 dark:bg-brand-100/40 dark:text-brand-900">
                  <WalletIcon className="h-6 w-6" />
                </span>
                <h2 className="text-h3 text-ink">No accounts yet</h2>
                <p className="max-w-sm text-body-sm text-ink-muted">
                  Add your first account by hand, or start from your onboarding numbers. Nothing
                  here is connected to a real bank.
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <Button size="sm" onClick={() => { setAddAccountOpen(true); setSheetNonce((n) => n + 1); }}>
                    <PlusIcon className="h-4 w-4" />
                    Add account
                  </Button>
                  <Link to="/setup" className={buttonClass("secondary", "sm")}>
                    Edit onboarding numbers
                  </Link>
                </div>
              </div>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-faint">
                Accounts · tap for transactions
              </p>
              {household.accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onOpen={() => setViewAndSearch({ kind: "transactions", accountId: account.id })}
                />
              ))}
            </div>
          )}

          {/* quick view for the first account's balance */}
          {(() => {
            const demoAccount = household.accounts[0];
            return demoAccount && demoAccount.availableBalanceCents !== null ? (
              <Card className="border-brand-200/60 bg-brand-50/60 dark:bg-brand-100/20">
                <p className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-faint">
                  Quick check
                </p>
                <p className="mt-1.5 text-body-sm text-ink-muted">
                  {demoAccount.name} has{" "}
                  <Money cents={demoAccount.availableBalanceCents} className="font-semibold text-ink" />{" "}
                  available ({formatCents(demoAccount.availableBalanceCents)}). Plans deduct bills,
                  essentials, goals, giving, and your buffer from this — see Home for the full
                  breakdown.
                </p>
              </Card>
            ) : null;
          })()}

          {/* the rest of More */}
          <MoreSections onOpen={(section) => setViewAndSearch({ kind: "section", section })} />
        </div>
      ) : view.kind === "overview" ? (
        <OverviewView
          household={household}
          onBack={() => setViewAndSearch({ kind: "accounts" })}
          onOpenAccount={(accountId) =>
            setViewAndSearch({ kind: "transactions", accountId })
          }
        />
      ) : view.kind === "section" ? (
        <SectionView
          section={view.section}
          household={household}
          onBack={() => setViewAndSearch({ kind: "accounts" })}
        />
      ) : (
        <TransactionsView
          household={household}
          selectedAccountId={view.accountId}
          onSelectAccount={(accountId) => setViewAndSearch({ kind: "transactions", accountId })}
          onBack={() => setViewAndSearch({ kind: "accounts" })}
          onAddTransaction={() => openAddTxn(view.accountId === ALL_ACCOUNTS ? null : view.accountId)}
        />
      )}

      {/* sheets */}
      <AddAccountSheet
        key={`aa${sheetNonce}`}
        open={addAccountOpen}
        household={household}
        onClose={() => setAddAccountOpen(false)}
      />
      <AddTransactionSheet
        key={`at${sheetNonce}`}
        open={addTxnTarget !== null}
        household={household}
        defaultAccountId={addTxnTarget}
        onClose={() => setAddTxnTarget(null)}
      />
      <ImportSheet open={importOpen} household={household} onClose={() => setImportOpen(false)} />
      <ExportSheet open={exportOpen} household={household} onClose={() => setExportOpen(false)} />
    </div>
  );
}

/** One of the five More section screens (Credit / Discover / Support / Privacy / Settings). */
function SectionView({
  section,
  household,
  onBack,
}: {
  section: MoreSectionId;
  household: NonNullable<ReturnType<typeof useClientData>["household"]>;
  onBack: () => void;
}) {
  switch (section) {
    case "credit":
      return <CreditView household={household} onBack={onBack} />;
    case "discover":
      return <DiscoverView household={household} onBack={onBack} />;
    case "support":
      return <SupportView onBack={onBack} />;
    case "privacy":
      return <PrivacyView onBack={onBack} onDeleted={onBack} />;
    case "settings":
      return <SettingsView household={household} onBack={onBack} />;
  }
}