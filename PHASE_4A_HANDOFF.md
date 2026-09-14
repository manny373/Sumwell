# Phase 4a handoff (INCOMPLETE — pick up here)

Branch: `phase-4a-finance-consistency` (uncommitted working tree as of this note).

## Done (working source, not yet test-green)
- `finance/types.ts`: GivingSchedule -> GivingFrequency (weekly|biweekly|twiceMonthly|monthly);
  GivingPlan.frequency; Debt.accountId?; Debt.minPaymentDueDay?; CommitmentKind += debtMinimum|debtExtra.
- `finance/giving.ts`: REWRITTEN — perCheckToPeriod/perMonthToPerCheck/perCheckShare (frequency-aware,
  never ÷2 by assumption; biweekly=26/yr vs twiceMonthly=24/yr), givingForPeriod (percent linear,
  fixed via per-check share; unknown pay cadence = documented limitation), givingImpact (same-period
  numerator/denominator), frequencyWord/fixedAmountNote/givingLabel (single label source).
  Policy DECLARED: per-pay-period model; monthly gift on twice-monthly pay = amount/2; on biweekly =
  amount*12/26.
- `finance/plan.ts`: planForPaycheck now takes debtMinimums[] + debtExtraCents (ledger entries,
  shortfall keeps exact). DebtMinimumDeduction type.
- `finance/seed.ts`: givingPlan frequency:"monthly"; debt minPaymentDueDay (card 22, auto 5, federal 25,
  private 28, medical 15) + accountId links; goal-contribution note no raw id.
- `client/types.ts`: PlanAssumptions.adoptedDebtExtraCents? (what-if budget stays debtExtraBudgetCents).
- `client/household.ts`: DEMO_PLAN_ASSUMPTIONS updated (adopted:0; comments now hand-check to
  remaining $340.24 = 1799.94 − 358.70 − 291.00 − 250 − 200 − 60 − 300); manualGivingPlan frequency
  "biweekly" (declared assumption); adoptedDebtExtraFor + withAdoptedDebtExtra.
- `client/plan.ts`: REWRITTEN — payFrequencyFor (gap classification), givingForCycle (new signature:
  plan, payFrequency, net, gross), debtMinimumAudit (per-debt EXACTLY-ONCE bucket: inWindow |
  paidOnRecord | afterWindow | noDueDate; posted-payment window start = last received paycheck),
  cycleDebtMinimums, buildHomePlan now passes debt minimums + adopted extra per check; HomePlan.nextObligation
  is now {name, amountCents, dueDate, kind} incl. debt minimums.
- `client/planScreen.ts`: REWRITTEN — cycleDebtMinimumsView, debtStrategyView (what-if vs adopted,
  gap computation), givingView (single label source, same-period percentages), automationRuleViews:
  perPaycheck rules anchor to THE next paycheck date; onDueDate rules anchor to the LINKED DEBT's own
  due day via nextMonthlyOccurrence; "due date unknown" when no due day. Date + explanation derive
  from the same scheduling result (ruleTrigger).
- `client/dates.ts`: formatMonthYear, formatCycleRange (wrap-safe, year when crossing), formatPayoffDateLabel.
- `client/progress.ts`: REWRITTEN (Finding 5) — no debtBalanceReduced invented claims; "Payment
  recorded — $X" + balance-today stated as-is; evidenceId + evidenceRecordFor() (resolves to real
  record or "Record not found"); technicalId only surfaced via <details>; checkInSummary.
- `client/store.tsx`: setAdoptedDebtExtra.
- Routes: `_app.plan.tsx` (what-if box + Apply to my plan + gap + MinimumsThisCycle + "Projected
  payoff" + formatPayoffDateLabel + giving single label + cycle range full string),
  `_app.home.tsx` (debt minimums/extra rows in equation; next-obligation flattened),
  `_app.progress.tsx` (View evidence Sheet + <details> technical ids).

## NOT done (budget ran out)
1. TESTS ARE BROKEN. Existing test files reference the old API (givingPlan.schedule,
   givingImpact args/skipped/note, givingView.scheduleLabel/basisLabel, givingForCycle 2-arg,
   progress "debtBalanceReduced", plan.test nextObligation.obligation, debt.test Debt literal).
   `bunx tsc --noEmit` currently fails in src/**/*.test.ts (~25 errors) — list is in /tmp/tsc.txt.
2. New tests required by the task (conversions weekly/biweekly/twiceMonthly/monthly, same-period
   percentage, label parity, no silent 2-check, creditor-specific due dates, canonical paycheck
   days, month-end 31st-in-short-month, what-if never mutates adopted, adoption flows to Home +
   shortfall, no cross-obligation substitution property over the seed, payoff year+months, evidence
   resolves) are NOT written.
3. `bun test src/lib` NOT green (never will be until tests are updated); `bun run build` NOT verified.
4. NOT committed, NOT pushed, NOT published (task forbids publish anyway).

## Next steps (in order)
1. Update tests: finance/giving.test.ts + plan.test.ts (new signatures); client/plan.test.ts
   (givingForCycle 4-arg; nextObligation flat; debt-minimum cases); client/planScreen.test.ts
   (GivingView new shape; debtStrategyView what-if/adopted); client/progress.test.ts (drop
   debtBalanceReduced); finance/debt.test.ts (Debt literal needs minPaymentDueDay: null).
2. Write the NEW Phase 4a tests described above.
3. `bunx tsc --noEmit` clean, `bun test src/lib` green, `bun run build` green.
4. Update skills/sumwell-finance-core SKILL.md (GivingPlan changed materially).
5. Commit + push (GIT_TERMINAL_PROMPT=0). Do NOT publish (task rule).

## Declared policies to carry into Phase 4b
- Giving per-period: monthly gift on twice-monthly pay reserves amount/2 per check; on biweekly pay
  reserves amount*12/26; per-paycheck plans allocate the full amount per check; percent gifts are
  linear (percentage period-invariant).
- Debt minimums: in-window = deducted once by the current plan; paid-on-record (posted payment on/after
  the last received paycheck) = covered, never re-deducted; after-window = future cycle; no due day =
  "due date unknown".
- Adopted extra debt: monthly → per-check via perMonthToPerCheck using payFrequencyFor; pay cadence
  unknown = adoption can't convert (limitation, not zero).
