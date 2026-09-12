import { useMemo, useState } from "react";
import { Link, Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Banner } from "~/components/Banner";
import { Button, buttonClass } from "~/components/Button";
import { Card } from "~/components/Card";
import { LoadingState } from "~/components/LoadingState";
import { Money } from "~/components/Money";
import { Sheet } from "~/components/Dialog";
import { Select } from "~/components/Select";
import { Switch } from "~/components/Switch";
import { TextField } from "~/components/TextField";
import { DonutChart } from "~/components/charts";
import { PlanIcon, WarningIcon } from "~/components/icons";
import { useClientData } from "~/lib/client/store";
import { todayISO, formatWeekdayMonthDay } from "~/lib/client/dates";
import { buildHomePlan } from "~/lib/client/plan";
import {
  automationRuleViews,
  cycleObligationsView,
  debtStrategyView,
  DEBT_GROUP_ORDER,
  debtGroupName,
  givingView,
  goalViews,
} from "~/lib/client/planScreen";
import type { GivingPlan } from "~/lib/finance/types";
import { formatBpsAsPercent, formatCents, formatDollars, parseDollarsToCents } from "~/lib/money";
import { cn } from "~/lib/cn";

export const Route = createFileRoute("/_app/plan")({
  component: PlanRoute,
});

/* ------------------------------------------------------- shared bits --- */

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

function SectionHeading({
  step,
  title,
  note,
}: {
  step: string;
  title: string;
  note?: string;
}) {
  return (
    <div className="mt-2 flex items-start gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-caption font-bold text-brand-800 dark:bg-brand-100/40 dark:text-brand-900"
      >
        {step}
      </span>
      <div className="min-w-0">
        <h2 className="text-h2 text-ink">{title}</h2>
        {note ? <p className="mt-0.5 text-caption text-ink-muted">{note}</p> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------ 1. bills & obligations */

function BillsSection({ household }: { household: Household }) {
  const view = useMemo(
    () => cycleObligationsView(household),
    [household],
  );
  const cycleLabel =
    view.windowStart && view.windowEnd
      ? `${formatWeekdayMonthDay(view.windowStart).slice(0, -4)} → ${formatWeekdayMonthDay(view.windowEnd)}`
      : "this cycle";
  return (
    <section aria-labelledby="plan-bills">
      <SectionHeading
        step="1"
        title="Bills & obligations"
        note={`Bills due in this pay cycle (${cycleLabel})`}
      />
      <Card className="mt-3">
        <ul className="divide-y divide-line-faint">
          {view.obligations.map((o) => (
            <li key={o.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-body font-medium text-ink">{o.name}</p>
                <p className="mt-0.5 text-caption text-ink-muted">
                  Due day {o.dueDay ?? "—"} · {o.cadence}
                  {o.essential ? " · essential" : ""}
                  {o.alreadyReflected ? " · already reflected in your balance" : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Money cents={o.amountCents} className="text-num text-ink" />
                {o.alreadyReflected ? (
                  <span className="rounded-pill border border-line-strong bg-surface-sunken px-2 py-0.5 text-caption text-ink-muted">
                    in balance — not re-deducted
                  </span>
                ) : (
                  <span className="text-caption text-ink-faint">deducted once</span>
                )}
              </div>
            </li>
          ))}
          {view.obligations.length === 0 ? (
            <li className="py-6 text-center text-body-sm text-ink-muted">
              No bills are scheduled inside this pay cycle.
            </li>
          ) : null}
        </ul>
        <div className="mt-2 border-t border-line pt-3">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-body-sm font-semibold text-ink">Cycle total</p>
            <Money cents={view.totalCents} className="text-num-lg text-ink" />
          </div>
          <p className="mt-1 text-caption leading-relaxed text-ink-muted">
            {view.reflectedCount > 0
              ? `${formatDollars(view.reflectedCents)} is already inside your available balance — it is shown above and never deducted again. Only ${formatDollars(
                  view.deductedCents,
                )} is committed out of this cycle's plan.`
              : `All ${view.obligations.length} bills are committed once against this cycle's plan.`}
          </p>
          <Link
            to="/setup"
            className={buttonClass("secondary", "sm", "mt-3")}
          >
            Edit assumptions
          </Link>
        </div>
      </Card>
    </section>
  );
}

/* --------------------------------------------------- 2. debt strategies */

function DebtSection({ household }: { household: Household }) {
  const today = todayISO();
  const { setDebtExtraBudget } = useClientData();
  const view = useMemo(
    () => debtStrategyView(household, today),
    [household, today],
  );
  const [draft, setDraft] = useState(
    formatDollars(view.extraBudgetCents).replace(/\.00$/, ""),
  );

  const commit = () => {
    const cents = parseDollarsToCents(draft);
    if (cents !== null) setDebtExtraBudget(cents);
    else setDraft(formatDollars(view.extraBudgetCents).replace(/\.00$/, ""));
  };

  if (household.debts.length === 0) {
    return (
      <section aria-labelledby="plan-debt">
        <SectionHeading step="2" title="Debt strategies" />
        <Card className="mt-3">
          <p className="text-body font-medium text-ink">No debts on record</p>
          <p className="mt-1 text-body-sm text-ink-muted">
            This household has no debts yet, so there is nothing to compare. The
            demo household includes a credit card, auto loan, student loans, and
            a medical bill if you want to see the scenarios.
          </p>
        </Card>
      </section>
    );
  }

  const { comparison: c, extraBudgetCents, minimumsCents, monthlyTotalCents } = view;
  const strategies: Array<{
    key: "avalanche" | "snowball";
    title: string;
    subtitle: string;
    result: (typeof c)["avalanche"];
  }> = [
    {
      key: "avalanche",
      title: "Avalanche",
      subtitle: "Highest APR first",
      result: c.avalanche,
    },
    {
      key: "snowball",
      title: "Snowball",
      subtitle: "Smallest balance first",
      result: c.snowball,
    },
  ];

  return (
    <section aria-labelledby="plan-debt">
      <SectionHeading
        step="2"
        title="Debt strategies"
        note={`Both scenarios keep every minimum payment and add the same extra budget. Payoff dates and interest are ESTIMATES — today's balances, rates, and minimums held constant.`}
      />
      <Card className="mt-3">
        <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
          <div onBlur={commit}>
            <TextField
              label="Extra debt payment budget"
              prefix="$"
              suffix="/month"
              numeric
              value={draft}
              onChange={setDraft}
              hint="Used by both scenarios. Estimates only — this is a plan, not a transfer."
            />
          </div>
          <div className="rounded-control border border-line-strong bg-surface-sunken px-3.5 py-3">
            <p className="text-caption font-medium text-ink-muted">Monthly cash toward debt</p>
            <p className="mt-0.5 text-num text-ink">
              <Money cents={monthlyTotalCents} />{" "}
              <span className="text-caption font-normal text-ink-muted">
                = minimums <Money cents={minimumsCents} /> + extra{" "}
                <Money cents={extraBudgetCents} />
              </span>
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {strategies.map((s) => {
            const r = s.result;
            const groups = DEBT_GROUP_ORDER.map((group) => ({
              group,
              rows: r.payoffRows.filter((row) => debtGroupName(row) === group),
            })).filter((g) => g.rows.length > 0);
            return (
              <div
                key={s.key}
                className={cn(
                  "rounded-card border p-4",
                  s.key === "avalanche"
                    ? "border-brand-200/70 bg-brand-50/50 dark:bg-brand-100/10"
                    : "border-line bg-surface-sunken/60",
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <h3 className="text-h3 text-ink">{s.title}</h3>
                    <p className="text-caption text-ink-muted">{s.subtitle}</p>
                  </div>
                  <EstimateChip />
                </div>
                <dl className="mt-3 flex flex-col gap-1.5 text-body-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-ink-muted">Total interest (estimate)</dt>
                    <dd className="text-right text-num text-ink">
                      {r.totalInterestCents === null ? (
                        <>
                          <span className="text-ink-muted">Incomplete</span> —{" "}
                          <Money cents={r.totalInterestKnownCents} /> known
                        </>
                      ) : (
                        <Money cents={r.totalInterestCents} />
                      )}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-ink-muted">Debt-free by (estimate)</dt>
                    <dd className="text-num text-ink">
                      {r.lastPayoffDate
                        ? formatWeekdayMonthDay(r.lastPayoffDate)
                        : "Beyond the modeled horizon"}
                    </dd>
                  </div>
                </dl>
                {r.totalInterestCents === null ? (
                  <p className="mt-2 rounded-control bg-warning-soft px-2.5 py-1.5 text-caption text-warning">
                    Some rates are unknown — interest totals are incomplete and
                    never invented.
                  </p>
                ) : null}
                <div className="mt-3 space-y-3">
                  {groups.map(({ group, rows }) => (
                    <div key={group}>
                      <p className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-faint">
                        {group}
                      </p>
                      <ul className="mt-1 divide-y divide-line-faint">
                        {rows.map((row) => (
                          <li key={row.debtId} className="flex items-start justify-between gap-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-body-sm font-medium text-ink">
                                {row.name}
                              </p>
                              <p className="text-caption text-ink-muted">
                                {row.aprBps === null ? (
                                  <span className="font-medium text-warning">Rate unknown</span>
                                ) : (
                                  `${formatBpsAsPercent(row.aprBps)} APR (${row.aprKind})`
                                )}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-caption text-ink-muted">paid off</p>
                              <p className="text-body-sm font-medium text-ink">
                                {row.payoffDate
                                  ? formatWeekdayMonthDay(row.payoffDate)
                                  : "—"}
                              </p>
                              <p className="text-caption text-ink-muted">
                                {row.interestCents === null
                                  ? "interest: not shown"
                                  : `interest ${formatCents(row.interestCents)}`}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <ul className="mt-4 flex flex-col gap-1">
          {c.avalanche.estimateNotes.map((n) => (
            <li key={n} className="text-caption leading-relaxed text-ink-muted">
              · {n}
            </li>
          ))}
          <li className="text-caption leading-relaxed text-ink-faint">
            · No refinancing advice and no forgiveness assumptions are made here —
            this compares payment order only.
          </li>
        </ul>
      </Card>
    </section>
  );
}

/* --------------------------------------------------------- 3. goals --- */

function GoalsSection({ household }: { household: Household }) {
  const { setGoalPriority } = useClientData();
  const views = useMemo(() => goalViews(household), [household]);

  if (views.length === 0) {
    return (
      <section aria-labelledby="plan-goals">
        <SectionHeading step="3" title="Savings goals" />
        <Card className="mt-3">
          <p className="text-body font-medium text-ink">No savings goals yet</p>
          <p className="mt-1 text-body-sm text-ink-muted">
            Add a goal in the edit form to start planning a target.
          </p>
        </Card>
      </section>
    );
  }

  return (
    <section aria-labelledby="plan-goals">
      <SectionHeading
        step="3"
        title="Savings goals"
        note="Priorities are editable. Accepted contributions are allocations — they do not move money."
      />
      <div className="mt-3 flex flex-col gap-3">
        {views.map(({ goal: g, acceptedCents }) => {
          const pct = Math.round((g.percentCompleteBps / 10000) * 100);
          return (
            <Card key={g.goal.id}>
              <div className="flex items-start gap-4">
                <DonutChart
                  value={g.currentSavedCents}
                  max={g.targetCents}
                  size={92}
                  thickness={9}
                  ariaLabel={`${g.goal.name}: ${formatDollars(g.currentSavedCents)} of ${formatDollars(
                    g.targetCents,
                  )} saved`}
                >
                  <span className="text-caption font-semibold text-ink">
                    {pct}%
                  </span>
                </DonutChart>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-h4 text-ink">{g.goal.name}</h3>
                      <p className="mt-0.5 text-caption text-ink-muted">
                        {g.goal.kind === "emergencyFund"
                          ? "Emergency fund"
                          : "Custom goal"}{" "}
                        · priority {g.goal.priority}
                      </p>
                    </div>
                    <label className="sr-only" htmlFor={`goal-prio-${g.goal.id}`}>
                      Priority for {g.goal.name}
                    </label>
                    <Select
                      id={`goal-prio-${g.goal.id}`}
                      label={""}
                      aria-label={`Priority for ${g.goal.name}`}
                      value={String(g.goal.priority)}
                      onChange={(e) =>
                        setGoalPriority(g.goal.id, Number(e.target.value))
                      }
                      className="w-24 shrink-0"
                    >
                      {views.map((_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <p className="mt-1 text-body-sm text-ink">
                    Saved <Money cents={g.currentSavedCents} /> of{" "}
                    <Money cents={g.targetCents} />
                  </p>
                  <p className="mt-1 text-caption text-ink-muted">
                    {acceptedCents > 0 ? (
                      <>
                        This cycle: <Money cents={acceptedCents} /> allocation
                        (accepted in your plan — an allocation only, it does not
                        move money)
                      </>
                    ) : (
                      "No allocation accepted this cycle."
                    )}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <p className="mt-2 text-caption text-ink-faint">
        Dated, confirmed contribution history and projections live on the
        Progress tab — kept strictly separate.
      </p>
    </section>
  );
}

/* ----------------------------------------------------------- 4. giving */

function GivingSection({ household }: { household: Household }) {
  const { setGivingPlan } = useClientData();
  const [editorOpen, setEditorOpen] = useState(false);
  const view = useMemo(() => givingView(household), [household]);
  const [draftMode, setDraftMode] = useState<"fixed" | "percent">(
    household.givingPlan.mode,
  );
  const [draftEnabled, setDraftEnabled] = useState(household.givingPlan.enabled);
  const [draftAmount, setDraftAmount] = useState(
    household.givingPlan.amountCents === null
      ? ""
      : formatDollars(household.givingPlan.amountCents).replace(/\.00$/, ""),
  );
  const [draftPercent, setDraftPercent] = useState(
    household.givingPlan.percentBps === null
      ? ""
      : String(household.givingPlan.percentBps / 100).replace(/\.0+$/, ""),
  );

  const openEditor = () => {
    setDraftMode(household.givingPlan.mode);
    setDraftEnabled(household.givingPlan.enabled);
    setDraftAmount(
      household.givingPlan.amountCents === null
        ? ""
        : formatDollars(household.givingPlan.amountCents).replace(/\.00$/, ""),
    );
    setDraftPercent(
      household.givingPlan.percentBps === null
        ? ""
        : String(household.givingPlan.percentBps / 100).replace(/\.0+$/, ""),
    );
    setEditorOpen(true);
  };

  const save = () => {
    const next: GivingPlan = { ...household.givingPlan, enabled: draftEnabled };
    if (draftMode === "percent") {
      const bps = Math.round((Number(draftPercent) || 0) * 100);
      next.mode = "percent";
      next.amountCents = null;
      next.percentBps = Math.min(10000, Math.max(0, bps));
    } else {
      next.mode = "fixed";
      next.percentBps = null;
      next.amountCents = parseDollarsToCents(draftAmount) ?? 0;
    }
    setGivingPlan(next);
    setEditorOpen(false);
  };

  const skipped = view.impact?.skipped ?? true;

  return (
    <section aria-labelledby="plan-giving">
      <SectionHeading
        step="4"
        title="Giving (optional)"
        note="No percentage is preselected — amount, timing, and priority are your choices. This prototype makes no tax-deduction claims and no religious assumptions."
      />
      <Card className="mt-3">
        {skipped ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-h4 text-ink">Skipped</p>
              <p className="mt-0.5 text-body-sm text-ink-muted">
                No gift is planned for this period — nothing is deducted for
                giving.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={openEditor}>
              Set giving
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-h4 text-ink">{view.amountNote}</p>
              <p className="mt-0.5 text-caption text-ink-muted">
                Planned {view.scheduleLabel} · basis: {view.basisLabel}
              </p>
              <dl className="mt-3 flex flex-col gap-1 text-body-sm">
                <div className="flex items-baseline justify-between gap-6">
                  <dt className="text-ink-muted">This period (per check)</dt>
                  <dd className="text-num text-ink">
                    {view.cycleGivingCents === null ? (
                      "—"
                    ) : (
                      <Money cents={view.cycleGivingCents} />
                    )}
                  </dd>
                </div>
                {view.impact ? (
                  <>
                    <div className="flex items-baseline justify-between gap-6">
                      <dt className="text-ink-muted">
                        Share of {view.basisLabel} (estimate)
                      </dt>
                      <dd className="text-num text-ink">
                        {view.impact.percentBps === null
                          ? "—"
                          : formatBpsAsPercent(view.impact.percentBps)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-6">
                      <dt className="text-ink-muted">
                        Share of this month's bills + goal allocations (estimate)
                      </dt>
                      <dd className="text-num text-ink">
                        {view.impact.shareOfCommitmentsBps === null
                          ? "—"
                          : formatBpsAsPercent(view.impact.shareOfCommitmentsBps)}
                      </dd>
                    </div>
                  </>
                ) : null}
              </dl>
            </div>
            <Button variant="secondary" size="sm" onClick={openEditor}>
              Edit giving
            </Button>
          </div>
        )}
        <p className="mt-3 border-t border-line-faint pt-2.5 text-caption leading-relaxed text-ink-muted">
          {view.impact?.note}
        </p>
      </Card>

      <Sheet
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title="Giving (optional)"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save giving plan</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Switch
            checked={draftEnabled}
            onChange={setDraftEnabled}
            label="Give this period"
          />
          <div role="group" aria-label="Giving mode" className="flex gap-2">
            {(["fixed", "percent"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={draftMode === m}
                onClick={() => setDraftMode(m)}
                className={cn(
                  "h-10 flex-1 rounded-control border text-body-sm font-semibold transition-colors",
                  draftMode === m
                    ? "border-brand-600 bg-brand-100 text-brand-800 dark:bg-brand-100/40 dark:text-brand-900"
                    : "border-line-strong bg-surface-sunken text-ink-muted hover:text-ink",
                )}
              >
                {m === "fixed" ? "Fixed amount" : "Percent of net pay"}
              </button>
            ))}
          </div>
          {draftMode === "fixed" ? (
            <TextField
              label="Amount per period"
              prefix="$"
              numeric
              value={draftAmount}
              onChange={setDraftAmount}
              hint={`Planned ${household.givingPlan.schedule} in this prototype.`}
            />
          ) : (
            <TextField
              label="Percent of net pay"
              suffix="%"
              numeric
              value={draftPercent}
              onChange={setDraftPercent}
              hint="Percent giving is budgeted from net pay. 0% counts as skipped."
            />
          )}
          <p className="text-caption leading-relaxed text-ink-muted">
            This only changes the plan — no transfer happens and no money moves.
            Gifts are not claimed to be tax-deductible here.
          </p>
        </div>
      </Sheet>
    </section>
  );
}

/* --------------------------------------------------- 5. automation ----- */

function AutomationSection({ household }: { household: Household }) {
  const { setRuleStatus, setAllRulesPaused } = useClientData();
  const today = todayISO();
  const views = useMemo(
    () => automationRuleViews(household, today),
    [household, today],
  );
  const allPaused = views.length > 0 && views.every((v) => v.paused);

  return (
    <section aria-labelledby="plan-automation">
      <SectionHeading
        step="5"
        title="Automation (simulated only)"
        note="Data only — these rules preview what a transfer WOULD look like. Nothing executes, nothing moves, and a preview is never authorization."
      />
      <Card className="mt-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-h4 text-ink">Draft rules</p>
            <p className="mt-0.5 text-caption text-ink-muted">
              Statuses are draft or paused — never submitted, settled, or failed.
              Submitted ≠ settled, and no transfer is ever made against a
              paycheck that hasn't arrived.
            </p>
          </div>
          <Button
            variant={allPaused ? "secondary" : "secondary"}
            size="sm"
            onClick={() => setAllRulesPaused(!allPaused)}
            aria-pressed={allPaused}
          >
            {allPaused ? "Resume all previews" : "Pause all previews"}
          </Button>
        </div>

        {views.length === 0 ? (
          <div className="mt-4 rounded-control border border-line bg-surface-sunken px-4 py-5">
            <p className="text-body font-medium text-ink">No automation rules yet</p>
            <p className="mt-0.5 text-body-sm text-ink-muted">
              Rules are a demo feature — try the demo household to see simulated
              previews with pause controls.
            </p>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {views.map((v) => (
              <li
                key={v.rule.id}
                className={cn(
                  "rounded-control border p-4",
                  v.paused ? "border-line bg-surface-sunken/70" : "border-line-strong bg-surface-raised",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-h4 text-ink">{v.rule.name}</h3>
                      <span
                        className={cn(
                          "rounded-pill px-2 py-0.5 text-caption font-semibold",
                          v.paused
                            ? "border border-line-strong bg-surface-sunken text-ink-muted"
                            : "border border-warning/40 bg-warning-soft text-warning",
                        )}
                      >
                        {v.paused ? "Paused (simulated)" : "Draft — preview only"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-caption text-ink-muted">
                      {v.scheduleLabel} · cap{" "}
                      <Money cents={v.maxCents} /> per trigger · simulated
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setRuleStatus(v.rule.id, v.paused ? "draft" : "paused")
                    }
                  >
                    {v.paused ? "Resume (simulate)" : "Pause (simulated)"}
                  </Button>
                </div>

                {v.paused ? (
                  <p className="mt-3 rounded-control bg-surface-sunken px-3 py-2 text-caption text-ink-muted">
                    Paused — this preview is inactive and nothing would move.
                  </p>
                ) : v.stale ? (
                  <p className="mt-3 rounded-control bg-warning-soft px-3 py-2 text-caption text-warning">
                    The modeled trigger date for this household has already
                    passed — the preview is not shown for out-of-date data.
                  </p>
                ) : v.unresolved ? (
                  <p className="mt-3 rounded-control bg-warning-soft px-3 py-2 text-caption text-warning">
                    {v.unresolved}
                  </p>
                ) : (
                  <div className="mt-3 rounded-control border border-line-faint bg-surface-sunken/60 p-3">
                    <p className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-faint">
                      Preview (simulated — nothing moves)
                    </p>
                    <dl className="mt-2 flex flex-col gap-1.5 text-body-sm">
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-ink-muted">Would move</dt>
                        <dd className="text-num text-ink">
                          {v.wouldMoveCents === null ? (
                            "unresolved"
                          ) : (
                            <Money cents={v.wouldMoveCents} />
                          )}
                          <span className="ml-1.5 text-caption font-normal text-ink-muted">
                            {v.amountLabel}
                          </span>
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-ink-muted">From → to</dt>
                        <dd className="text-right text-ink">
                          {v.sourceAccount?.name ?? "Unknown account"} →{" "}
                          {v.destinationAccount?.name ?? "Unknown account"}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-ink-muted">When</dt>
                        <dd className="text-right text-ink">
                          {v.triggerDate
                            ? `${formatWeekdayMonthDay(v.triggerDate)} — ${v.triggerLabel}`
                            : v.triggerLabel}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-ink-muted">From balance</dt>
                        <dd className="text-right text-ink">
                          {v.sourceAvailableCents === null ? (
                            "Unknown — no estimate shown"
                          ) : (
                            <>
                              <Money cents={v.sourceAvailableCents} /> available
                              today{v.forecast ? ` → lowest ${formatCents(v.forecast.lowestBalanceCents)} in window` : ""}
                            </>
                          )}
                        </dd>
                      </div>
                    </dl>
                    {v.sufficient === false ? (
                      <p className="mt-2 rounded-control bg-warning-soft px-2.5 py-1.5 text-caption font-medium text-warning">
                        Funds insufficient on the trigger day — this rule would
                        pause rather than overdraw.
                      </p>
                    ) : null}
                    {v.incomeUncertain ? (
                      <p className="mt-2 flex items-start gap-1.5 text-caption text-ink-muted">
                        <WarningIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        This preview assumes a paycheck that hasn't arrived yet —
                        an estimate, never an authorization to move money.
                      </p>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 border-t border-line-faint pt-2.5 text-caption leading-relaxed text-ink-muted">
          Rules are data in this prototype: no processor is connected, no
          transfer is ever submitted, and "preview" never equals "paid".
        </p>
      </Card>
    </section>
  );
}

/* ------------------------------------------------------------ the route */

function PlanRoute() {
  const { status, onboarded, household, startOver } = useClientData();
  const navigate = useNavigate();

  if (status !== "ready") return <LoadingState label="Loading your plan…" />;
  if (!onboarded || !household) return <Navigate to="/" replace />;

  const now = todayISO();
  const home = buildHomePlan(household, now);
  const stale = home.reason === "stale";

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
          <PlanIcon className="h-6 w-6 text-brand-700 dark:text-brand-900" />
          <h1 className="text-h1 text-ink">Plan</h1>
        </div>
        <p className="mt-1 text-body-sm text-ink-muted">
          What's committed this cycle — and what could change. Every number is
          an estimate from {household.label}; nothing here is a promise.
        </p>
      </header>

      {stale ? (
        <Banner
          variant="stale"
          title="This household's modeled payday has passed"
          description="The cycle numbers below reference the modeled Sep 25, 2026 payday. Treat them as demo history and edit the numbers for a fresh plan."
        />
      ) : null}

      <BillsSection household={household} />
      <DebtSection household={household} />
      <GoalsSection household={household} />
      <GivingSection household={household} />
      <AutomationSection household={household} />

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

/* Household is imported only as a type for the section props above. */
import type { Household } from "~/lib/client/types";