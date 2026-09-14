import { useMemo, useState } from "react";
import { Link, Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Banner } from "~/components/Banner";
import { Button } from "~/components/Button";
import { Card } from "~/components/Card";
import { LoadingState } from "~/components/LoadingState";
import { Money } from "~/components/Money";
import { Sheet } from "~/components/Dialog";
import { DonutChart, LineChart } from "~/components/charts";
import { ProgressIcon } from "~/components/icons";
import { useClientData } from "~/lib/client/store";
import { todayISO, formatMonthDay, formatWeekdayMonthDay } from "~/lib/client/dates";
import { buildHomePlan } from "~/lib/client/plan";
import {
  allConfirmedChanges,
  checkInSummary,
  evidenceRecordFor,
  goalProgressViews,
  type ConfirmedChange,
} from "~/lib/client/progress";
import { formatDollars } from "~/lib/money";
import type { Household } from "~/lib/client/types";

export const Route = createFileRoute("/_app/progress")({
  component: ProgressRoute,
});

function SourceChip({ label }: { label: string }) {
  return (
    <span className="rounded-pill border border-warning/40 bg-warning-soft px-2.5 py-1 text-caption font-semibold text-warning">
      {label}
    </span>
  );
}

function EstimateChip() {
  return (
    <span className="rounded-pill border border-line-strong bg-surface-sunken px-2 py-0.5 text-caption text-ink-muted">
      estimate
    </span>
  );
}

function ConfirmedChip() {
  return (
    <span className="rounded-pill border border-success/40 bg-success-soft px-2 py-0.5 text-caption font-semibold text-success">
      confirmed
    </span>
  );
}

/* --------------------------------------- 1. confirmed changes (evidence) */

function ConfirmedChangesSection({ household }: { household: Household }) {
  const changes = useMemo(() => allConfirmedChanges(household), [household]);
  const [evidenceFor, setEvidenceFor] = useState<ConfirmedChange | null>(null);
  const evidence = useMemo(
    () => (evidenceFor ? evidenceRecordFor(household, evidenceFor) : null),
    [household, evidenceFor],
  );

  return (
    <section aria-labelledby="progress-changes">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-h3 text-ink">Confirmed changes</h2>
          <ConfirmedChip />
        </div>
        <p className="mt-1 text-caption text-ink-muted">
          Dated + evidence only — every row has a "View evidence" link that
          opens the actual record behind it. The app never takes credit for
          progress it did not observe and never infers a balance change from a
          payment alone.
        </p>
        {changes.length === 0 ? (
          <div className="mt-4 rounded-control border border-dashed border-line-strong bg-surface-sunken/60 px-4 py-6 text-center">
            <p className="text-body font-medium text-ink">No confirmed changes yet</p>
            <p className="mx-auto mt-1 max-w-md text-caption leading-relaxed text-ink-muted">
              Confirmed changes (with dates and evidence) will appear here once
              money actually moves — a posted loan payment, a savings deposit, a
              card payment. Pending items are never counted.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-line-faint">
            {changes.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-body font-medium text-ink">{c.title}</p>
                    <span className="text-caption text-ink-faint">
                      {formatWeekdayMonthDay(c.date)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-caption leading-relaxed text-ink-muted">
                    {c.detail}
                  </p>
                  {c.balanceTodayCents !== null ? (
                    <p className="mt-0.5 text-caption text-ink-muted">
                      Balance today: <Money cents={c.balanceTodayCents} />
                      {c.balanceTodayAccountName
                        ? ` on ${c.balanceTodayAccountName}`
                        : ""}{" "}
                      — the balance is stated as it is, not as a reduction.
                    </p>
                  ) : (
                    <p className="mt-0.5 text-caption text-ink-muted">
                      No balance change is claimed — a dated balance history
                      isn't on record yet.
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEvidenceFor(c)}
                    >
                      View evidence
                    </Button>
                    <details className="text-caption text-ink-faint">
                      <summary className="cursor-pointer select-none">
                        Technical details
                      </summary>
                      <p className="mt-1">Record id: {c.technicalId}</p>
                    </details>
                  </div>
                </div>
                <Money
                  cents={c.amountCents}
                  options={{ signed: true }}
                  className="shrink-0 text-num text-success dark:text-accent-700"
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Sheet
        open={evidenceFor !== null}
        onClose={() => setEvidenceFor(null)}
        title={evidenceFor ? `Evidence — ${evidenceFor.title}` : "Evidence"}
        footer={
          <Button variant="ghost" onClick={() => setEvidenceFor(null)}>
            Close
          </Button>
        }
      >
        {evidenceFor === null ? null : evidence === null ? (
          <div className="rounded-control border border-warning/40 bg-warning-soft px-3 py-4">
            <p className="text-body-sm font-semibold text-warning">
              Record not found
            </p>
            <p className="mt-1 text-caption text-ink-muted">
              The record behind this change no longer exists in this household.
              It is shown as missing rather than invented.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-faint">
                Record type
              </p>
              <p className="mt-0.5 text-body-sm font-medium text-ink">
                {evidence.recordType === "transaction"
                  ? "Transaction"
                  : "Goal contribution"}
              </p>
            </div>
            <p className="text-body-sm text-ink">{evidence.heading}</p>
            <dl className="flex flex-col gap-1.5 text-body-sm">
              {evidence.rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-6"
                >
                  <dt className="text-ink-muted">{row.label}</dt>
                  <dd className="text-right text-num text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>
            <details className="text-caption text-ink-faint">
              <summary className="cursor-pointer select-none">
                Technical details
              </summary>
              <p className="mt-1">Record id: {evidence.technicalId}</p>
            </details>
          </div>
        )}
      </Sheet>
    </section>
  );
}

/* ------------------------------------------ 2. since your last check-in */

function CheckInSection({ household }: { household: Household }) {
  const summary = useMemo(() => checkInSummary(household), [household]);

  return (
    <section aria-labelledby="progress-checkin">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-h3 text-ink">What changed since your last check-in</h2>
          <span className="rounded-pill border border-line-strong bg-surface-sunken px-2 py-0.5 text-caption text-ink-muted">
            {summary.windowLabel}
          </span>
        </div>
        <p className="mt-1 text-body-sm text-ink-muted">{summary.message}</p>
        {summary.changes.length > 0 ? (
          <ul className="mt-3 divide-y divide-line-faint">
            {summary.changes.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 py-2">
                <p className="text-body-sm text-ink">{c.title}</p>
                <Money
                  cents={c.amountCents}
                  options={{ signed: true }}
                  className="shrink-0 text-num text-success dark:text-accent-700"
                />
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 border-t border-line-faint pt-2 text-caption text-ink-faint">
          In this prototype, "last check-in" is modeled as your most recent
          received paycheck — real, dated money on record.
        </p>
      </Card>
    </section>
  );
}

/* ---------------------------------------------------- 3. goal progress --- */

function GoalProgressSection({ household }: { household: Household }) {
  const views = useMemo(() => goalProgressViews(household), [household]);

  if (views.length === 0) {
    return (
      <section aria-labelledby="progress-goals">
        <Card>
          <h2 className="text-h3 text-ink">Goal progress</h2>
          <p className="mt-1 text-body-sm text-ink-muted">
            No savings goals in this household yet.
          </p>
        </Card>
      </section>
    );
  }

  return (
    <section aria-labelledby="progress-goals" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-h3 text-ink">Goal progress</h2>
        <EstimateChip />
      </div>
      {views.map(({ goal: g, acceptedCents }) => {
        const pct = Math.round((g.percentCompleteBps / 10000) * 100);
        const points = g.confirmedHistory.map((p) => p.runningTotalCents);
        const labels = g.confirmedHistory.map((p) => formatMonthDay(p.date));
        return (
          <Card key={g.goal.id}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <DonutChart
                value={g.currentSavedCents}
                max={g.targetCents}
                size={104}
                thickness={10}
                ariaLabel={`${g.goal.name}: ${formatDollars(g.currentSavedCents)} of ${formatDollars(g.targetCents)}`}
              >
                <span className="text-num font-semibold text-ink">{pct}%</span>
              </DonutChart>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-h4 text-ink">{g.goal.name}</h3>
                    <p className="mt-0.5 text-caption text-ink-muted">
                      {g.goal.kind === "emergencyFund" ? "Emergency fund" : "Custom goal"} · priority{" "}
                      {g.goal.priority}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-caption text-ink-faint">saved</p>
                    <Money cents={g.currentSavedCents} className="text-num text-ink" />
                    <p className="text-caption text-ink-muted">
                      of <Money cents={g.targetCents} />
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-caption text-ink-muted">
                  The saved balance comes from your account records. Confirmed
                  history only shows dated deposits with evidence.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 border-t border-line-faint pt-4 lg:grid-cols-2">
              <div className="rounded-control border border-line-faint bg-surface-sunken/50 p-3">
                <p className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-faint">
                  Confirmed history
                </p>
                {g.confirmedHistory.length === 0 ? (
                  <p className="mt-2 text-caption text-ink-muted">
                    No confirmed deposits on record for this goal.
                  </p>
                ) : (
                  <>
                    {points.length >= 2 ? (
                      <LineChart
                        points={points}
                        labels={labels}
                        height={34}
                        ariaLabel={`${g.goal.name} confirmed running total over time`}
                        className="mt-2"
                        showDots
                      />
                    ) : null}
                    <ul className="mt-2 flex flex-col gap-1">
                      {g.confirmedHistory.map((p) => (
                        <li
                          key={p.date}
                          className="flex items-baseline justify-between gap-3 text-caption"
                        >
                          <span className="text-ink-muted">{formatMonthDay(p.date)}</span>
                          <span className="text-ink">
                            <Money cents={p.contributionCents} options={{ signed: true }} />
                          </span>
                        </li>
                      ))}
                      <li className="flex items-baseline justify-between gap-3 border-t border-line-faint pt-1 text-caption font-semibold">
                        <span className="text-ink-muted">Confirmed total</span>
                        <Money cents={g.confirmedTotalCents} className="text-ink" />
                      </li>
                    </ul>
                  </>
                )}
              </div>

              <div className="rounded-control border border-brand-200/60 bg-brand-50/50 p-3 dark:bg-brand-100/10">
                <p className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-faint">
                  Projected — if you follow this plan
                </p>
                {g.projected.length === 0 ? (
                  <p className="mt-2 text-caption text-ink-muted">
                    No projected line items — nothing is planned for this goal
                    this cycle.
                  </p>
                ) : (
                  <>
                    <ul className="mt-2 flex flex-col gap-1">
                      {g.projected.map((p) => (
                        <li
                          key={`${p.date}-${p.amountCents}`}
                          className="flex items-baseline justify-between gap-3 text-caption"
                        >
                          <span className="text-ink-muted">
                            on {formatMonthDay(p.date)}
                          </span>
                          <span className="text-ink">
                            <Money cents={p.amountCents} options={{ signed: true }} />
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-caption leading-relaxed text-ink-muted">
                      These are projections — the accepted allocation this cycle
                      ({acceptedCents > 0 ? formatDollars(acceptedCents) : "$0"}). They are
                      NOT saved yet and are kept separate from confirmed history.
                    </p>
                  </>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </section>
  );
}

/* ------------------------------------------------------------ the route */

function ProgressRoute() {
  const { status, onboarded, household, startOver } = useClientData();
  const navigate = useNavigate();

  if (status !== "ready") return <LoadingState label="Loading progress…" />;
  if (!onboarded || !household) return <Navigate to="/" replace />;

  const now = todayISO();
  const stale = buildHomePlan(household, now).reason === "stale";

  return (
    <div className="flex flex-col gap-6 pb-6">
      <header>
        <div className="flex items-center justify-between gap-3">
          <SourceChip
            label={
              household.source === "demo"
                ? "Synthetic demo data"
                : "Your numbers · saved on this device"
            }
          />
          <Link
            to="/setup"
            className="rounded-pill border border-line-strong bg-surface-raised px-3 py-1.5 text-caption font-medium text-ink-muted transition-colors hover:border-brand-600 hover:text-brand-700 dark:hover:text-brand-500"
          >
            Edit assumptions
          </Link>
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          <ProgressIcon className="h-6 w-6 text-brand-700 dark:text-brand-900" />
          <h1 className="text-h1 text-ink">Progress</h1>
        </div>
        <p className="mt-1 text-body-sm text-ink-muted">
          What has actually changed — with dates and evidence. Everything that
          is estimated says so; nothing here is a guarantee.
        </p>
      </header>

      {stale ? (
        <Banner
          variant="stale"
          title="This household's modeled payday has passed"
          description="The dated records below are still history, but plan-based projections reference the modeled Sep 25, 2026 payday. Edit the numbers for a fresh plan."
        />
      ) : null}

      <CheckInSection household={household} />
      <ConfirmedChangesSection household={household} />
      <GoalProgressSection household={household} />

      <div className="mt-1 flex items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-caption text-ink-faint">
          Prototype only — not a financial service. Don't want this data saved
          on this device?
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
    </div>
  );
}