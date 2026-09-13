/**
 * Discover — Phase 3d. Labeled synthetic offers only.
 *
 * Every card carries the sample disclaimer, the compensation disclosure, and
 * an expiration note. Expired terms never appear (the filter in
 * src/lib/offers.ts is the only path in). Rewards-led card samples are
 * suppressed for households carrying revolving card debt — the demo household
 * has card debt, so the suppression note should be visible there. Approval
 * likelihood is never shown, and "Keep your current account" / "No suitable
 * offer right now" are first-class outcomes.
 */
import { Banner } from "~/components/Banner";
import { Card } from "~/components/Card";
import { CheckIcon, InfoIcon } from "~/components/icons";
import { useMemo } from "react";
import type { Household } from "~/lib/client/types";
import { formatMonthDay, todayISO } from "~/lib/client/dates";
import {
  COMPENSATION_DISCLOSURE,
  NO_APPROVAL_NOTE,
  OFFER_DISCLAIMER,
  offersForHousehold,
  type DemoOffer,
} from "~/lib/offers";
import { formatBpsAsPercent } from "~/lib/money";
import { SectionScaffold } from "./SectionScaffold";

function OfferCard({ offer }: { offer: DemoOffer }) {
  return (
    <Card className="border-warning/50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-block rounded-pill border border-warning/40 bg-warning-soft px-2.5 py-1 text-caption font-bold text-warning">
            {OFFER_DISCLAIMER}
          </span>
          <p className="mt-2.5 text-h4 text-ink">
            {offer.provider} · {offer.product}
          </p>
          <p className="mt-0.5 text-caption text-ink-muted">{offer.conditionNote}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-faint">
            Sample {offer.rateKind}
          </p>
          <p className="mt-0.5 text-num-lg text-ink">
            {offer.rateBps === null ? "n/a" : formatBpsAsPercent(offer.rateBps)}
          </p>
          <p className="text-caption text-ink-muted">
            {offer.rateBps === null ? "not published" : offer.rateKind}
          </p>
        </div>
      </div>

      <dl className="mt-3 flex flex-col gap-1.5 border-t border-line-faint pt-3 text-body-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted">Fees (sample)</dt>
          <dd className="text-right text-ink">{offer.feeNote ?? "Not published"}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted">Terms verified</dt>
          <dd className="text-right text-ink">{formatMonthDay(offer.verifiedAt)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted">Sample expires</dt>
          <dd className="text-right font-medium text-warning">
            {formatMonthDay(offer.expiresAt)} — expires terms are never recommended
          </dd>
        </div>
      </dl>

      <p className="mt-3 rounded-control bg-surface-sunken px-3 py-2 text-caption leading-relaxed text-ink-muted">
        {COMPENSATION_DISCLOSURE}
      </p>
      <p className="mt-1.5 text-caption leading-relaxed text-ink-faint">
        {NO_APPROVAL_NOTE} No real link exists in the prototype — the referral
        field is stored as data and stays empty until real partners exist.
      </p>
    </Card>
  );
}

export function DiscoverView({
  household,
  onBack,
}: {
  household: Household;
  onBack: () => void;
}) {
  const today = todayISO();
  const { offers, expiredCount, suppressedRewards, suppressedRewardsCount } =
    useMemo(() => offersForHousehold(household, today), [household, today]);
  const noSuitable = offers.length === 0;

  return (
    <SectionScaffold
      title="Discover"
      subtitle="Sample products to compare — every one is synthetic, clearly dated, and never tied to an approval guess."
      onBack={onBack}
    >
      <Banner
        variant="warning"
        title="Nothing here is a real offer"
        description="These samples come from a small prototype dataset. No provider is connected, nothing is approved, and opening nothing here is possible — there are no real links."
      />

      {suppressedRewards ? (
        <Banner
          variant="stale"
          title={`${suppressedRewardsCount} rewards-led card sample hidden`}
          description="This household is carrying a credit-card balance, so rewards-focused card offers are suppressed — they're not recommended to households paying off revolving debt. Savings samples and the no-rewards card sample remain."
        />
      ) : null}

      {/* First-class option: keep the current account. */}
      <Card className="border-brand-200/60 bg-brand-50/60 dark:bg-brand-100/20">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-800 dark:bg-brand-100/40 dark:text-brand-900">
            <CheckIcon className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="text-h4 text-ink">Keep your current account</p>
            <p className="mt-0.5 text-body-sm leading-relaxed text-ink-muted">
              No change is the right default. These samples are comparison
              material only — your current accounts stay exactly as they are
              unless you decide otherwise.
            </p>
          </div>
        </div>
      </Card>

      {noSuitable ? (
        <Card className="border-danger/30 bg-danger-soft/40">
          <p className="text-h4 text-ink">No suitable offer right now</p>
          <p className="mt-1 text-body-sm leading-relaxed text-ink-muted">
            Every sample term in the prototype dataset has expired as of today,
            and expired terms are never recommended — so there is nothing
            suitable to show.{" "}
            {suppressedRewards
              ? "Household-specific rules also hid rewards-led card samples."
              : ""}{" "}
            Keeping your current account is the recommended path.
          </p>
        </Card>
      ) : (
        <>
          <p className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-faint">
            Samples with current terms ({offers.length})
          </p>
          <div className="flex flex-col gap-3">
            {offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
          <p className="flex items-start gap-2 text-caption leading-relaxed text-ink-faint">
            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {expiredCount} sample{" "}
            {expiredCount === 1 ? "term has" : "terms have"} already expired and
            are filtered out — expired terms are never recommended. Compensation
            is disclosed beside each recommendation, and approving a sample
            never implies approval for you.
          </p>
        </>
      )}
    </SectionScaffold>
  );
}