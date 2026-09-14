import { Link, Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card } from "~/components/Card";
import { Banner } from "~/components/Banner";
import { Button, buttonClass } from "~/components/Button";
import { LoadingState } from "~/components/LoadingState";
import { Money } from "~/components/Money";
import { ChevronRightIcon, HeartIcon } from "~/components/icons";
import { useClientData } from "~/lib/client/store";
import { buildHomePlan, daysUntilDue, type HomePlan } from "~/lib/client/plan";
import { formatDollars } from "~/lib/money";
import { todayISO, formatWeekdayMonthDay, relativeDaysLabel } from "~/lib/client/dates";
import type { Household } from "~/lib/client/types";

export const Route = createFileRoute("/_app/home")({
  component: HomeRoute,
});

/* ------------------------------------------------------------- tiny bits */

function SourceChip({ household }: { household: Household }) {
  return household.source === "demo" ? (
    <span className="rounded-pill border border-warning/40 bg-warning-soft px-2.5 py-1 text-caption font-semibold text-warning">
      Synthetic demo data
    </span>
  ) : (
    <span className="rounded-pill border border-line-strong bg-surface-raised px-2.5 py-1 text-caption font-semibold text-ink-muted">
      Your numbers · saved on this device
    </span>
  );
}

/* --------------------------------------------- paycheck horizon (card 1) */

function PaycheckHorizonCard({ plan }: { plan: HomePlan }) {
  const { paycheck, daysUntilPaycheck, incomeUncertain } = plan;
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-faint">
            Next paycheck
          </p>
          <p className="mt-1.5 text-num-lg text-ink">
            {formatWeekdayMonthDay(paycheck.date)}
          </p>
          <p className="mt-1 text-caption text-ink-muted">
            {paycheck.employer} · <Money cents={paycheck.netCents} />
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="rounded-pill bg-brand-100 px-2.5 py-1 text-caption font-semibold text-brand-800 dark:bg-brand-100/40 dark:text-brand-900">
            {daysUntilPaycheck === 0 ? "today" : `${daysUntilPaycheck} days away`}
          </span>
          {incomeUncertain ? (
            <span className="rounded-pill border border-line-strong bg-surface-sunken px-2.5 py-1 text-caption font-medium text-ink-muted">
              Estimated until received
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------- remaining money (card 2) */

function PlanSegmentsBar({ plan }: { plan: HomePlan }) {
  const { plan: result, availableCents } = plan;
  if (availableCents === null || availableCents <= 0) return null;
  // When short, the bar overshoots by the shortfall so over-spending is visible.
  const total = availableCents + Math.max(0, -result.remainingCents);
  const seg = (cents: number) => (total > 0 ? (cents / total) * 100 : 0);
  const segments = [
    { label: "Bills", value: result.obligationsDeductedCents, fill: "fill-brand-200" },
    { label: "Essentials", value: result.essentialsCents, fill: "fill-brand-400" },
    { label: "Goals & giving", value: result.goalsCents + result.givingCents, fill: "fill-accent-500" },
    { label: "Buffer", value: result.bufferCents, fill: "fill-line-strong" },
  ];
  const remainingLabel = result.isShortfall ? "Shortfall" : "Left over";
  const remainingFill = result.isShortfall ? "fill-danger" : "fill-brand-600";
  const all = [
    ...segments,
    { label: remainingLabel, value: Math.abs(result.remainingCents), fill: remainingFill },
  ];

  let x = 0;
  const rects = all.map((s) => {
    const width = seg(s.value);
    const rect = { key: s.label, x, width, fill: s.fill };
    x += width;
    return rect;
  });

  return (
    <div className="flex flex-col gap-2">
      <svg
        role="img"
        aria-label={`${formatDollars(availableCents)} available, split into bills, essentials, goals and giving, buffer, and ${remainingLabel} of ${formatDollars(Math.abs(result.remainingCents))}`}
        viewBox="0 0 100 10"
        className="h-2.5 w-full rounded-full"
        preserveAspectRatio="none"
      >
        {rects.map(
          (r) =>
            r.width >= 0.4 && (
              <rect
                key={r.key}
                x={r.x}
                y="0"
                width={Math.max(r.width, 0.4)}
                height="10"
                className={r.fill}
                rx="1.5"
              />
            ),
        )}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {all
          .filter((s) => s.value > 0)
          .map((s) => (
            <span key={s.label} className="flex items-center gap-1.5 text-caption text-ink-muted">
              <span aria-hidden="true" className={`h-2 w-2 rounded-sm ${s.fill}`} />
              {s.label}
            </span>
          ))}
      </div>
    </div>
  );
}

function EquationRow({
  label,
  caption,
  cents,
  tone = "ink",
}: {
  label: string;
  caption?: string;
  cents: number;
  tone?: "ink" | "danger";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <div className="min-w-0">
        <p className="text-body-sm font-medium text-ink">{label}</p>
        {caption ? <p className="truncate text-caption text-ink-faint">{caption}</p> : null}
      </div>
      <Money
        cents={cents}
        className={`shrink-0 text-num ${tone === "danger" ? "text-danger" : "text-ink"}`}
      />
    </div>
  );
}

function RemainingMoneyCard({ plan, household }: { plan: HomePlan; household: Household }) {
  const result = plan.plan;
  const goalsGivingCents = result.goalsCents + result.givingCents;
  const goalNames = household.assumptions.goalContributions.map((g) => g.name).join(" · ");

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <p className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-faint">
          Estimated remaining money
        </p>
        <span className="rounded-pill border border-line-strong bg-surface-sunken px-2 py-0.5 text-caption text-ink-muted">
          estimate
        </span>
      </div>

      <div className="mt-3">
        <PlanSegmentsBar plan={plan} />
      </div>

      <div className="mt-4 border-t border-line-faint pt-2">
        <EquationRow
          label="Available"
          caption="From your checking balance"
          cents={plan.availableCents!}
        />
        <EquationRow
          label="Obligations"
          caption={`${plan.obligations.length} ${plan.obligations.length === 1 ? "bill" : "bills"} due before the next paycheck`}
          cents={result.obligationsDeductedCents}
        />
        {result.debtMinimumsCents > 0 ? (
          <EquationRow
            label="Debt minimums"
            caption={`${plan.debtMinimums.length} minimum due before the next paycheck — each counted once`}
            cents={result.debtMinimumsCents}
          />
        ) : null}
        {result.debtExtraCents > 0 ? (
          <EquationRow
            label="Extra debt payment"
            caption="Adopted on the Plan tab — committed for this period"
            cents={result.debtExtraCents}
          />
        ) : null}
        <EquationRow
          label="Essentials"
          caption="Estimated essential spending this cycle"
          cents={result.essentialsCents}
        />
        <EquationRow
          label="Goals & giving"
          caption={
            [goalNames, plan.givingCents !== null ? "Giving" : null]
              .filter(Boolean)
              .join(" · ") || "None this cycle"
          }
          cents={goalsGivingCents}
        />
        <EquationRow
          label="Buffer"
          caption="Kept in checking, not spent"
          cents={result.bufferCents}
        />
      </div>

      <div
        className={`mt-3 flex items-baseline justify-between gap-4 rounded-control px-3.5 py-3 ${
          result.isShortfall ? "bg-danger-soft" : "bg-success-soft"
        }`}
      >
        <p className="text-body-sm font-semibold text-ink">
          {result.isShortfall ? "Plan shortfall (exact)" : "Left over after this plan"}
        </p>
        <Money
          cents={result.remainingCents}
          options={{ signed: true }}
          className={`text-num-lg ${
            result.isShortfall ? "text-danger" : "text-success dark:text-accent-700"
          }`}
        />
      </div>
      <p className="mt-2 text-caption text-ink-faint">
        Income is still estimated until the paycheck arrives. Every number above
        is a plan, not a promise.
      </p>
    </Card>
  );
}

/* ---------------------------------------------- next obligation (card 3) */

function NextObligationCard({ plan }: { plan: HomePlan }) {
  const next = plan.nextObligation;
  if (!next) {
    return (
      <Card>
        <p className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-faint">
          Next obligation
        </p>
        <p className="mt-2 text-h4 text-ink">Nothing due before payday</p>
        <p className="mt-1 text-body-sm text-ink-muted">
          No bills or minimum payments are scheduled between now and your next
          paycheck.
        </p>
      </Card>
    );
  }
  const dueIn = daysUntilDue(next.dueDate, todayISO());
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-faint">
            Next obligation
          </p>
          <p className="mt-1.5 truncate text-h4 text-ink">{next.name}</p>
          <p className="mt-0.5 text-caption text-ink-muted">
            {next.kind === "debtMinimum" ? "Minimum payment · " : ""}Due{" "}
            {formatWeekdayMonthDay(next.dueDate)} · {relativeDaysLabel(dueIn)}
          </p>
        </div>
        <Money cents={next.amountCents} className="shrink-0 text-num-lg text-ink" />
      </div>
    </Card>
  );
}

/* ------------------------------------------------- next action (card 4) */

function NextActionCard({ plan }: { plan: HomePlan }) {
  const result = plan.plan;
  const shortfall = result.shortfallCents;
  const next = plan.nextObligation;

  let title: string;
  let body: string;

  if (result.isShortfall) {
    title = `This plan is short ${formatDollars(shortfall)} by ${formatWeekdayMonthDay(plan.paycheck.date)}.`;
    body =
      "Trim this cycle's goals or giving, or move a non-essential bill to after payday. Nothing moves automatically — this is a plan, not a transfer.";
  } else if (next) {
    title = `Set aside ${formatDollars(next.amountCents)} for ${next.name} by ${formatWeekdayMonthDay(next.dueDate)}.`;
    body = `That keeps the bill covered before your next paycheck, with ${formatDollars(result.remainingCents)} left over for everything else.`;
  } else {
    title = `Keep ${formatDollars(result.remainingCents)} available this cycle.`;
    body =
      "Nothing is due before your next paycheck — spend it, save it, or give it. Your buffer is already set aside.";
  }

  return (
    <Card className={result.isShortfall ? "border-danger/30 bg-danger-soft/50" : "border-brand-200/60 bg-brand-50/60 dark:bg-brand-100/20"}>
      <p className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-faint">
        One next action
      </p>
      <p className="mt-2 text-h4 leading-snug text-ink">{title}</p>
      <p className="mt-1.5 text-body-sm text-ink-muted">{body}</p>
    </Card>
  );
}

/* ------------------------------------------- accounts route (card 5) */

function AccountsCard({ household }: { household: Household }) {
  const checking = household.accounts.find((a) => a.type === "checking");
  return (
    <Card interactive padded={false} className="overflow-hidden">
      <Link
        to="/more"
        className="flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-surface-sunken"
      >
        <div className="min-w-0">
          <p className="text-h4 text-ink">Accounts & transactions</p>
          <p className="mt-0.5 truncate text-body-sm text-ink-muted">
            {checking
              ? `${checking.name} · ${formatDollars(
                  checking.availableBalanceCents ?? checking.currentBalanceCents ?? 0,
                )} available`
              : "View your accounts and transactions"}
          </p>
        </div>
        <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-faint" />
      </Link>
    </Card>
  );
}

/* ------------------------------- giving shortcut (frequent givers) --- */

/**
 * Spec: frequent-giving households get an optional shortcut. Only shown when
 * the household has an ACTIVE giving plan and this cycle actually includes
 * giving; jumps straight to the Giving section on Plan.
 */
function GivingShortcutCard({ givingCents }: { givingCents: number | null }) {
  return (
    <Card interactive padded={false} className="overflow-hidden">
      <Link
        to="/plan"
        hash="giving"
        className="flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-surface-sunken"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-800 dark:bg-brand-100/40 dark:text-brand-900"
          >
            <HeartIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-h4 text-ink">Giving plan</p>
            <p className="mt-0.5 truncate text-body-sm text-ink-muted">
              {givingCents !== null
                ? `${formatDollars(givingCents)} planned this cycle · optional, your choice`
                : "Optional, your choice — view in Plan"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-body-sm font-medium text-ink-muted">
          View in Plan
          <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-faint" />
        </div>
      </Link>
    </Card>
  );
}

/* ------------------------------------------------------- honest states */

function StaleView({ household }: { household: Household }) {
  const navigate = useNavigate();
  const { startOver } = useClientData();
  return (
    <div className="flex flex-col gap-4">
      <Banner
        variant="stale"
        title="These numbers are out of date"
        description={`The next paycheck in this household (${household.source === "demo" ? "Sep 25, 2026" : "the scheduled pay date"}) has already passed, so a plan built from them would be guesswork. Enter your own numbers or start over.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/setup" className={buttonClass("primary", "sm")}>
              Enter your own numbers
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                startOver();
                void navigate({ to: "/" });
              }}
            >
              Start over
            </Button>
          </div>
        }
      />
      <Card>
        <p className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-faint">
          Why there's no estimate here
        </p>
        <p className="mt-2 text-body-sm text-ink-muted">
          Sumwell only shows remaining-money estimates from fresh data. Once a
          modeled payday has come and gone, the inputs are stale and any number
          we'd show would be a guess.
        </p>
      </Card>
    </div>
  );
}

function MissingInputsView({ title, description }: { title: string; description: string }) {
  const navigate = useNavigate();
  const { startOver } = useClientData();
  return (
    <div className="flex flex-col gap-4">
      <Banner
        variant="info"
        title={title}
        description={description}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/setup" className={buttonClass("primary", "sm")}>
              Edit your numbers
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                startOver();
                void navigate({ to: "/" });
              }}
            >
              Start over
            </Button>
          </div>
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------- the route */

function HomeRoute() {
  const { status, onboarded, household, startOver } = useClientData();
  const navigate = useNavigate();

  if (status !== "ready") {
    return <LoadingState label="Loading your plan…" />;
  }
  if (!onboarded || !household) {
    return <Navigate to="/" replace />;
  }

  const now = todayISO();
  const ctx = buildHomePlan(household, now);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <SourceChip household={household} />
          <Link
            to="/setup"
            className="rounded-pill border border-line-strong bg-surface-raised px-3 py-1.5 text-caption font-medium text-ink-muted transition-colors hover:border-brand-600 hover:text-brand-700 dark:hover:text-brand-500"
          >
            These are estimates — edit
          </Link>
        </div>
        <div>
          <h1 className="text-h1 text-ink">Paycheck plan</h1>
          <p className="mt-1 text-body-sm text-ink-muted">
            {household.label} · updated{" "}
            {new Date(household.generatedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      </header>

      {ctx.reason === "ok" && ctx.plan ? (
        <>
          <PaycheckHorizonCard plan={ctx.plan} />
          <RemainingMoneyCard plan={ctx.plan} household={household} />
          <NextObligationCard plan={ctx.plan} />
          <NextActionCard plan={ctx.plan} />
          {household.givingPlan.enabled ? (
            <GivingShortcutCard givingCents={ctx.plan.givingCents} />
          ) : null}
          <AccountsCard household={household} />
        </>
      ) : null}

      {ctx.reason === "stale" ? <StaleView household={household} /> : null}
      {ctx.reason === "no-paycheck" ? (
        <MissingInputsView
          title="No upcoming paycheck in this household"
          description="A plan needs a next pay date. Add your own numbers to see the paycheck plan."
        />
      ) : null}
      {ctx.reason === "no-balance" ? (
        <MissingInputsView
          title="Checking balance is unknown"
          description="The plan draws from your checking available balance, which isn't set. Add it in the edit form."
        />
      ) : null}

      {ctx.reason !== "ok" ? (
        <div className="mt-1 flex items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-caption text-ink-faint">
            Don't want this data saved on this device?
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              startOver();
              void navigate({ to: "/" });
            }}
          >
            Start over
          </Button>
        </div>
      ) : null}

      <p className="text-caption text-ink-faint">
        Prototype only — not a financial service. Nothing here is connected to a
        bank, and no transfers move real money.
      </p>
    </div>
  );
}