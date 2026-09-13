/**
 * Credit — Phase 3d. Truthful unavailable state first, a clearly labeled
 * synthetic score ONLY for the demo household, and no approval likelihood
 * anywhere. The score name is "Sumwell demo score" — never FICO/VantageScore.
 */
import { Banner } from "~/components/Banner";
import { Card } from "~/components/Card";
import { InfoIcon } from "~/components/icons";
import {
  CREDIT_PROTOTYPE_NOTE,
  REAL_CREDIT_REQUIREMENTS,
  syntheticCreditScore,
  SYNTHETIC_SCORE_LABEL,
} from "~/lib/credit";
import type { Household } from "~/lib/client/types";
import { formatMonthDay } from "~/lib/client/dates";
import { SectionScaffold } from "./SectionScaffold";

function RequirementList() {
  return (
    <Card>
      <h2 className="text-h3 text-ink">What a real credit score would need</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {REAL_CREDIT_REQUIREMENTS.map((req) => (
          <li key={req} className="flex items-start gap-2.5 text-body-sm text-ink-muted">
            <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
            {req}
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-line-faint pt-3 text-caption leading-relaxed text-ink-faint">
        Approval likelihood stays unknown — Sumwell never guesses whether you'd
        be approved for anything, and nothing here pulls or affects credit.
      </p>
    </Card>
  );
}

function SyntheticScoreCard({ household }: { household: Household }) {
  const score = syntheticCreditScore(household);
  if (!score) return null;
  const pct = Math.round(((score.value - score.range[0]) / (score.range[1] - score.range[0])) * 100);
  return (
    <Card className="border-warning/50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-pill border border-warning/40 bg-warning-soft px-2.5 py-1 text-caption font-bold text-warning">
              {SYNTHETIC_SCORE_LABEL}
            </span>
            <span className="text-caption text-ink-muted">
              as of {formatMonthDay(score.asOf)} · demo household only
            </span>
          </div>
          <p className="mt-3 text-caption font-semibold uppercase tracking-[0.08em] text-ink-faint">
            {score.name}
          </p>
          <p className="mt-1 text-num-xl tabular-nums text-ink">
            {score.value}
            <span className="text-caption font-medium text-ink-muted">
              {" "}
              / {score.range[1]}
            </span>
          </p>
        </div>
        <div className="w-full max-w-[11rem]" aria-hidden="true">
          <div className="h-2.5 w-full rounded-full bg-line-strong">
            <div
              className="h-full rounded-full bg-warning"
              style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
            />
          </div>
          <p className="mt-1.5 flex justify-between text-caption text-ink-faint">
            <span>{score.range[0]}</span>
            <span>{score.range[1]}</span>
          </p>
        </div>
      </div>
      <p className="mt-3 rounded-control bg-warning-soft px-3 py-2.5 text-body-sm leading-relaxed text-warning">
        {score.note}
      </p>
      <p className="mt-2 text-caption text-ink-muted">
        This number changes nothing: no bureau, no lender, no approval decision
        sees it. It exists only to show what a credit screen could look like
        once a real provider is approved (Milestone B+).
      </p>
    </Card>
  );
}

function NoScoreCard({ household }: { household: Household }) {
  return (
    <Card>
      <h2 className="text-h3 text-ink">No credit score is shown</h2>
      <p className="mt-2 text-body-sm leading-relaxed text-ink-muted">
        {household.source === "manual"
          ? "Your household was entered by hand, so there is no credit data and no synthetic score. A real score needs an approved provider reading a real credit file — neither exists in this prototype."
          : "No credit provider is connected, so there is no credit monitoring and no imported score in this prototype."}
      </p>
      <p className="mt-2 text-body-sm leading-relaxed text-ink-muted">
        Sumwell never manufactures a score from transactions, and it never will
        — a made-up number presented as real credit would be worse than no
        number at all.
      </p>
    </Card>
  );
}

export function CreditView({
  household,
  onBack,
}: {
  household: Household;
  onBack: () => void;
}) {
  const hasScore = syntheticCreditScore(household) !== null;
  return (
    <SectionScaffold
      title="Credit"
      subtitle="What credit monitoring would take — and why none of it is wired up in this prototype."
      onBack={onBack}
    >
      <Banner
        variant="info"
        title="No credit provider is connected"
        description={CREDIT_PROTOTYPE_NOTE}
      />
      {hasScore ? <SyntheticScoreCard household={household} /> : <NoScoreCard household={household} />}
      <RequirementList />
      <p className="flex items-start gap-2 text-caption leading-relaxed text-ink-faint">
        <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        This screen is part of the prototype. In production, credit monitoring
        would follow an approved provider, your identity verification, and your
        explicit consent — never a silent setup.
      </p>
    </SectionScaffold>
  );
}