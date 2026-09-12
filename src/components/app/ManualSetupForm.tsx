/**
 * Manual onboarding / edit form — Phase 3a.
 *
 * One calm, short form for both journeys:
 *   - onboarding: "Enter a few numbers" (no household yet),
 *   - edit: prefilled from the current household ("These are estimates — edit").
 *
 * Money is entered as dollars and converted to integer cents via
 * parseDollarsToCents on submit. Assumptions made here are visibly editable
 * the same way — the form round-trips through the same inputs.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, buttonClass } from "~/components/Button";
import { Card } from "~/components/Card";
import { Select } from "~/components/Select";
import { Switch } from "~/components/Switch";
import { TextField } from "~/components/TextField";
import { XIcon } from "~/components/icons";
import { formatDollars, parseDollarsToCents } from "~/lib/money";
import type { Household, ManualOnboardingInputs } from "~/lib/client/types";
import { eligibleAvailableCents, nextPaycheck } from "~/lib/client/plan";
import { todayISO } from "~/lib/client/dates";
import { HonestyChips } from "./HonestyChips";

export interface ManualSetupFormProps {
  /** Prefill source when editing an existing household. */
  initialHousehold?: Household | null;
  onSubmit(inputs: ManualOnboardingInputs): void;
  /** Primary button label. */
  submitLabel: string;
  backHref: string;
  backLabel: string;
}

interface ObligationRow {
  id: string;
  name: string;
  dollars: string;
  dueDay: string;
}

interface FormState {
  payDate: string;
  netPayDollars: string;
  availableDollars: string;
  obligations: ObligationRow[];
  essentialsDollars: string;
  bufferDollars: string;
  goalEnabled: boolean;
  goalName: string;
  goalTargetDollars: string;
  goalPerCycleDollars: string;
  givingChoice: "skip" | "fixed" | "percent";
  givingFixedDollars: string;
  givingPercent: string;
}

type FieldErrors = Partial<Record<string, string>>;

let rowCounter = 0;
function newRowId(): string {
  rowCounter += 1;
  return `ob-${Date.now().toString(36)}-${rowCounter}`;
}

function blankRow(): ObligationRow {
  return { id: newRowId(), name: "", dollars: "", dueDay: "" };
}

/** "10" or "10.5" from basis points (1000 = 10%). */
function percentBpsToString(bps: number): string {
  if (bps % 100 === 0) return String(bps / 100);
  return String((bps / 100).toFixed(2)).replace(/0+$/, "").replace(/\.$/, "");
}

function percentStringToBps(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) return null;
  return Math.round(parsed * 100);
}

/** Prefill the form with the current household's numbers (edit path). */
function prefill(household: Household | null): FormState {
  if (!household) {
    return {
      payDate: "",
      netPayDollars: "",
      availableDollars: "",
      obligations: [blankRow()],
      essentialsDollars: "",
      bufferDollars: "",
      goalEnabled: false,
      goalName: "",
      goalTargetDollars: "",
      goalPerCycleDollars: "",
      givingChoice: "skip",
      givingFixedDollars: "",
      givingPercent: "",
    };
  }

  const paycheck = nextPaycheck(household);
  const available = eligibleAvailableCents(household, paycheck ?? household.paychecks[0]);
  const contribution = household.assumptions.goalContributions[0];
  const goal = contribution
    ? household.goals.find((g) => g.id === contribution.goalId)
    : undefined;
  const giving = household.givingPlan;

  let givingChoice: FormState["givingChoice"] = "skip";
  if (giving.enabled && giving.mode === "fixed" && giving.amountCents !== null) {
    givingChoice = "fixed";
  } else if (giving.enabled && giving.mode === "percent" && giving.percentBps !== null) {
    givingChoice = "percent";
  }

  return {
    payDate: paycheck?.date ?? "",
    netPayDollars: paycheck ? formatDollars(paycheck.netCents) : "",
    availableDollars: available !== null ? formatDollars(available) : "",
    obligations: household.obligations.map((o) => ({
      id: o.id,
      name: o.name,
      dollars: formatDollars(o.amountCents),
      dueDay: o.dueDay !== null ? String(o.dueDay) : "",
    })),
    essentialsDollars: formatDollars(household.assumptions.essentialsPerCycleCents ?? 0),
    bufferDollars: formatDollars(household.assumptions.bufferCents ?? 0),
    goalEnabled: Boolean(contribution),
    goalName: contribution?.name ?? "",
    goalTargetDollars: goal ? formatDollars(goal.targetCents) : "",
    goalPerCycleDollars: contribution ? formatDollars(contribution.amountCents) : "",
    givingChoice,
    givingFixedDollars:
      giving.enabled && giving.amountCents !== null ? formatDollars(giving.amountCents) : "",
    givingPercent:
      giving.enabled && giving.percentBps !== null
        ? percentBpsToString(giving.percentBps)
        : "",
  };
}

export function ManualSetupForm({
  initialHousehold = null,
  onSubmit,
  submitLabel,
  backHref,
  backLabel,
}: ManualSetupFormProps) {
  const [form, setForm] = useState<FormState>(() => prefill(initialHousehold));
  const [errors, setErrors] = useState<FieldErrors>({});
  const today = useMemo(() => todayISO(), []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setObligation = (id: string, patch: Partial<ObligationRow>) =>
    setForm((f) => ({
      ...f,
      obligations: f.obligations.map((row) =>
        row.id === id ? { ...row, ...patch } : row,
      ),
    }));

  const removeObligation = (id: string) =>
    setForm((f) => ({
      ...f,
      obligations: f.obligations.filter((row) => row.id !== id),
    }));

  const validate = (): ManualOnboardingInputs | null => {
    const next: FieldErrors = {};

    const availableCents = parseDollarsToCents(form.availableDollars);
    if (availableCents === null || availableCents <= 0) {
      next.available = "Enter how much you can use in checking right now.";
    }

    if (!form.payDate) {
      next.payDate = "Pick the date of your next paycheck.";
    } else if (form.payDate < today) {
      next.payDate = "That date is in the past — pick the upcoming payday.";
    }

    const netPayCents = parseDollarsToCents(form.netPayDollars);
    if (netPayCents === null || netPayCents <= 0) {
      next.netPay = "Enter your estimated take-home pay for that check.";
    }

    const obligations = form.obligations
      .map((row, index) => {
        const amountCents = parseDollarsToCents(row.dollars);
        const dueDay = Number(row.dueDay);
        if (!row.name.trim()) next[`ob-${row.id}-name`] = "Add a name.";
        if (amountCents === null || amountCents <= 0) {
          next[`ob-${row.id}-amount`] = "Enter an amount.";
        }
        if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
          next[`ob-${row.id}-due`] = "Day 1–31";
        }
        return {
          id: row.id.startsWith("ob-") ? row.id : `ob-${row.id}`,
          name: row.name.trim(),
          amountCents: amountCents ?? 0,
          dueDay,
          index,
        };
      })
      .filter(
        (o) =>
          o.name !== "" && o.amountCents > 0 && o.dueDay >= 1 && o.dueDay <= 31,
      );
    if (obligations.length === 0) {
      next.obligations = "Add at least one bill so the plan has something to cover.";
    }

    const essentialsPerCycleCents = parseDollarsToCents(form.essentialsDollars) ?? 0;
    const bufferCents = parseDollarsToCents(form.bufferDollars) ?? 0;

    let goal: ManualOnboardingInputs["goal"] = null;
    if (form.goalEnabled) {
      const targetCents = parseDollarsToCents(form.goalTargetDollars);
      const perCycleCents = parseDollarsToCents(form.goalPerCycleDollars);
      if (!form.goalName.trim()) next.goalName = "Name the goal.";
      if (targetCents === null || targetCents <= 0) next.goalTarget = "Enter a target amount.";
      if (perCycleCents === null || perCycleCents <= 0) {
        next.goalPerCycle = "Enter how much per check.";
      }
      if (
        form.goalName.trim() &&
        (targetCents ?? 0) > 0 &&
        (perCycleCents ?? 0) > 0
      ) {
        goal = {
          name: form.goalName.trim(),
          targetCents: targetCents!,
          perCycleCents: perCycleCents!,
        };
      }
    }

    let giving: ManualOnboardingInputs["giving"] = {
      choice: "skip",
      fixedCents: null,
      percentBps: null,
    };
    if (form.givingChoice === "fixed") {
      const fixedCents = parseDollarsToCents(form.givingFixedDollars);
      if (fixedCents === null || fixedCents <= 0) {
        next.givingFixed = "Enter an amount per check.";
      } else {
        giving = { choice: "fixed", fixedCents, percentBps: null };
      }
    } else if (form.givingChoice === "percent") {
      const percentBps = percentStringToBps(form.givingPercent);
      if (percentBps === null) {
        next.givingPercent = "Enter a percent of net pay (1–100).";
      } else {
        giving = { choice: "percent", fixedCents: null, percentBps };
      }
    }

    const hasErrors = Object.keys(next).length > 0;
    setErrors(next);
    if (hasErrors) return null;

    return {
      availableCents: availableCents!,
      payDate: form.payDate,
      netPayCents: netPayCents!,
      obligations: obligations.map((o) => ({
        id: o.id,
        name: o.name,
        amountCents: o.amountCents,
        dueDay: o.dueDay,
      })),
      essentialsPerCycleCents,
      bufferCents,
      goal,
      giving,
      createdAt: initialHousehold?.createdAt,
    };
  };

  const handleSubmit = () => {
    const inputs = validate();
    if (inputs) onSubmit(inputs);
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Link to={backHref} className={buttonClass("ghost", "sm")}>
            {backLabel}
          </Link>
          <HonestyChips className="!justify-end" />
        </div>
        <div>
          <h1 className="text-h1 text-ink">
            {initialHousehold ? "Edit your numbers" : "Enter a few numbers"}
          </h1>
          <p className="mt-1.5 max-w-lg text-body-sm text-ink-muted">
            {initialHousehold
              ? "Your plan recalculates from these estimates the moment you save."
              : "A handful of estimates is enough for a clear first plan — nothing connects to a bank."}
          </p>
        </div>
      </header>

      <section aria-label="Your next paycheck" className="flex flex-col gap-3">
        <h2 className="text-h4 text-ink">
          <span className="mr-2 text-ink-faint">1</span>Your next paycheck
        </h2>
        <Card className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Pay date"
            type="date"
            value={form.payDate}
            onChange={(v) => set("payDate", v)}
            error={errors.payDate}
            hint="The day your next check is deposited."
          />
          <TextField
            label="Estimated net pay"
            prefix="$"
            numeric
            placeholder="0.00"
            value={form.netPayDollars}
            onChange={(v) => set("netPayDollars", v)}
            error={errors.netPay}
            hint="Take-home after taxes and deductions."
          />
        </Card>
      </section>

      <section aria-label="Money you can use now" className="flex flex-col gap-3">
        <h2 className="text-h4 text-ink">
          <span className="mr-2 text-ink-faint">2</span>Money you can use right now
        </h2>
        <Card>
          <TextField
            label="Available in checking"
            prefix="$"
            numeric
            placeholder="0.00"
            value={form.availableDollars}
            onChange={(v) => set("availableDollars", v)}
            error={errors.available}
            hint="Your checking balance before the next paycheck lands — the pool this plan draws from."
          />
        </Card>
      </section>

      <section aria-label="Bills before your next paycheck" className="flex flex-col gap-3">
        <h2 className="text-h4 text-ink">
          <span className="mr-2 text-ink-faint">3</span>Bills before the next paycheck
        </h2>
        <p className="-mt-1 text-body-sm text-ink-muted">
          The essential obligations this check has to cover before the next one arrives.
        </p>
        {errors.obligations ? (
          <p role="alert" className="text-caption font-medium text-danger">
            {errors.obligations}
          </p>
        ) : null}
        <div className="flex flex-col gap-3">
          {form.obligations.map((row) => (
            <Card key={row.id} className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <TextField
                label="Bill"
                placeholder="e.g. Rent"
                value={row.name}
                onChange={(v) => setObligation(row.id, { name: v })}
                error={errors[`ob-${row.id}-name`]}
                className="flex-1"
              />
              <TextField
                label="Amount"
                prefix="$"
                numeric
                placeholder="0.00"
                value={row.dollars}
                onChange={(v) => setObligation(row.id, { dollars: v })}
                error={errors[`ob-${row.id}-amount`]}
                className="sm:w-36"
              />
              <div className="flex items-end gap-2">
                <TextField
                  label="Due day"
                  numeric
                  placeholder="1–31"
                  value={row.dueDay}
                  onChange={(v) => setObligation(row.id, { dueDay: v })}
                  error={errors[`ob-${row.id}-due`]}
                  className="w-24"
                />
                <button
                  type="button"
                  aria-label={`Remove ${row.name || "this bill"}`}
                  onClick={() => removeObligation(row.id)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-control text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setForm((f) => ({ ...f, obligations: [...f.obligations, blankRow()] }))}
            >
              Add a bill
            </Button>
          </div>
        </div>
      </section>

      <section aria-label="What else this check covers" className="flex flex-col gap-3">
        <h2 className="text-h4 text-ink">
          <span className="mr-2 text-ink-faint">4</span>What else this check should cover
        </h2>
        <Card className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Essential spending"
            prefix="$"
            numeric
            placeholder="0.00"
            value={form.essentialsDollars}
            onChange={(v) => set("essentialsDollars", v)}
            hint="Groceries, gas, transit — a rough estimate per cycle."
          />
          <TextField
            label="Checking buffer"
            prefix="$"
            numeric
            placeholder="0.00"
            value={form.bufferDollars}
            onChange={(v) => set("bufferDollars", v)}
            hint="The cushion you keep in checking and don't spend."
          />
        </Card>
      </section>

      <section aria-label="Savings and giving (optional)" className="flex flex-col gap-3">
        <h2 className="text-h4 text-ink">
          <span className="mr-2 text-ink-faint">5</span>Optional — savings & giving
        </h2>
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-body-sm font-medium text-ink">Save toward a goal</p>
              <p className="text-caption text-ink-muted">A set amount per check, when you choose.</p>
            </div>
            <Switch
              checked={form.goalEnabled}
              onChange={(v) => set("goalEnabled", v)}
              label={form.goalEnabled ? "Goal on" : "Goal off"}
            />
          </div>
          {form.goalEnabled ? (
            <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
              <TextField
                label="Goal name"
                placeholder="e.g. Emergency fund"
                value={form.goalName}
                onChange={(v) => set("goalName", v)}
                error={errors.goalName}
              />
              <TextField
                label="Target"
                prefix="$"
                numeric
                placeholder="0.00"
                value={form.goalTargetDollars}
                onChange={(v) => set("goalTargetDollars", v)}
                error={errors.goalTarget}
              />
              <TextField
                label="Per check"
                prefix="$"
                numeric
                placeholder="0.00"
                value={form.goalPerCycleDollars}
                onChange={(v) => set("goalPerCycleDollars", v)}
                error={errors.goalPerCycle}
              />
            </div>
          ) : null}

          <div className="border-t border-line pt-4">
            <Select
              label="Giving"
              value={form.givingChoice}
              onChange={(e) => set("givingChoice", e.target.value as FormState["givingChoice"])}
            >
              <option value="skip">Skip giving this period (you can add it later)</option>
              <option value="fixed">Fixed amount</option>
              <option value="percent">Percent of net pay</option>
            </Select>
            <p className="mt-1.5 text-caption text-ink-muted">
              Optional, and entirely your choice — no percentage is preselected.
            </p>
            {form.givingChoice === "fixed" ? (
              <div className="mt-3 max-w-xs">
                <TextField
                  label="Amount per check"
                  prefix="$"
                  numeric
                  placeholder="0.00"
                  value={form.givingFixedDollars}
                  onChange={(v) => set("givingFixedDollars", v)}
                  error={errors.givingFixed}
                />
              </div>
            ) : null}
            {form.givingChoice === "percent" ? (
              <div className="mt-3 max-w-xs">
                <TextField
                  label="Percent of net pay"
                  suffix="%"
                  numeric
                  placeholder="10"
                  value={form.givingPercent}
                  onChange={(v) => set("givingPercent", v)}
                  error={errors.givingPercent}
                />
              </div>
            ) : null}
          </div>
        </Card>
      </section>

      <footer className="flex flex-col gap-2.5 rounded-card bg-surface-sunken p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-caption text-ink-muted">
          These numbers stay on this device — no account, no connection, no real
          money.
        </p>
        <Button size="lg" className="shrink-0" onClick={handleSubmit}>
          {submitLabel}
        </Button>
      </footer>
    </div>
  );
}