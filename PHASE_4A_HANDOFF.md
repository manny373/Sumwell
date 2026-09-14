# Phase 4a handoff (COMPLETE — landed on main)

Branch: `phase-4a-finance-consistency` — merged to `main` (fast-forward) and pushed to origin.
Suite: 232 tests green (1260 expect), `bunx tsc --noEmit` clean, `bun run build` green.
Policy notes below are folded into skills/sumwell-finance-core/SKILL.md — they are DECISIONS, not suggestions.

## Done (see git history on main — this section kept for provenance)
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

## Finished in the follow-up session (this session)
1. SUITE UPDATED to the new APIs (finance/giving.test.ts rewritten incl. new conversion/same-period/label tests; client/plan.test.ts, client/planScreen.test.ts, client/progress.test.ts migrated; finance/seed.test.ts, finance/debt.test.ts, client/household.test.ts, client/mutations.test.ts updated; 3 source tsc fixes: `== null` on minPaymentDueDay in client/plan.ts + client/planScreen.ts).
2. NEW TESTS added (38 new test cases; 194 → 232): giving conversions for all four frequencies, no-silent-÷2, same-period percentage invariant, label parity (givingView == givingLabel == Home), two-creditor own-due-day resolution, canonical next paycheck for payroll rules, month-end/31st-in-short-month boundaries, due-date-unknown fallback, no-cross-obligation substitution over the seed, adoption flows to Home + unaffordable adoption → shortfall, what-if never mutates adopted, debtMinimumAudit exactly-once over the seed, multi-year payoff label (year + months), no positive-balance debt labeled "paid off", "Payment recorded" never net-reduction, evidenceId resolves to a real record, no raw ids in copy.
3. GATES: tsc clean, `bun test src/lib` = 232 pass / 0 fail / 1260 expect, `bun run build` green.
4. SKILL updated: /home/team/shared/skills/sumwell-finance-core/SKILL.md now documents the Phase 4a giving/debt/plan/evidence APIs.
5. LANDED: committed on phase-4a-finance-consistency, fast-forwarded main, pushed main + branch (GIT_TERMINAL_PROMPT=0). NOT published (task rule).

## Next steps
None — Phase 4a is complete. Phase 4b picks up from main.

## Declared policies to carry into Phase 4b
- Giving per-period: monthly gift on twice-monthly pay reserves amount/2 per check; on biweekly pay
  reserves amount*12/26; per-paycheck plans allocate the full amount per check; percent gifts are
  linear (percentage period-invariant).
- Debt minimums: in-window = deducted once by the current plan; paid-on-record (posted payment on/after
  the last received paycheck) = covered, never re-deducted; after-window = future cycle; no due day =
  "due date unknown".
- Adopted extra debt: monthly → per-check via perMonthToPerCheck using payFrequencyFor; pay cadence
  unknown = adoption can't convert (limitation, not zero).
