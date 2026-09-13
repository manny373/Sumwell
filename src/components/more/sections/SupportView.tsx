/**
 * Support — Phase 3d. Short, honest help: how the demo works, that nothing is
 * connected or real, the prototype's limits — and a clear "this is a
 * prototype, not real support" framing. No fake tickets, no contact forms.
 */
import { Banner } from "~/components/Banner";
import { Card } from "~/components/Card";
import { SectionScaffold } from "./SectionScaffold";

const TOPICS: Array<{ title: string; body: string }> = [
  {
    title: "What is this?",
    body: "A clickable prototype of the Sumwell app, built to validate the product: a clear plan for every paycheck. It is for design review, not for managing real money.",
  },
  {
    title: "How does the demo work?",
    body: "Pick a demo household on the first screen and every section lights up with clearly labeled synthetic data. You can also enter a few numbers of your own. Everything runs in your browser and lives only in this device's local storage.",
  },
  {
    title: "Is any of this real?",
    body: "No. No bank is connected, no real money moves, no credit is pulled, no offers are real, and no payment ever succeeds. Every connected-looking thing is a labeled simulation or a sample.",
  },
  {
    title: "What are the limits?",
    body: "Accounts are manual or demo records — nothing syncs. Credit shows a truthful unavailable state (plus a clearly labeled synthetic score in the demo). Discover samples are synthetic with terms stored as data. Automation rules preview only — nothing is ever submitted or settled.",
  },
  {
    title: "Something looks wrong?",
    body: "You can refresh the page or use Start over (Settings → Start over, or the Start over link at the bottom of most tabs) to reset the prototype data. There is no ticket system in the prototype, and no one monitors this screen.",
  },
];

export function SupportView({ onBack }: { onBack: () => void }) {
  return (
    <SectionScaffold
      title="Support"
      subtitle="A few honest answers about the prototype — this is not real support."
      onBack={onBack}
    >
      <Banner
        variant="warning"
        title="This is a prototype — not real support"
        description="No support team watches this screen. If you're reporting an issue, tell the founder at the review checkpoint instead — there are no tickets and no reply here."
      />
      <div className="flex flex-col gap-3">
        {TOPICS.map((topic, index) => (
          <Card key={topic.title}>
            <p className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-faint">
              {String(index + 1).padStart(2, "0")}
            </p>
            <h2 className="mt-1 text-h4 text-ink">{topic.title}</h2>
            <p className="mt-1.5 text-body-sm leading-relaxed text-ink-muted">
              {topic.body}
            </p>
          </Card>
        ))}
      </div>
      <p className="text-caption leading-relaxed text-ink-faint">
        Milestone A scope: design, math, and flows for review. Real support,
        real accounts, and real data are later milestones — and this page will
        change before any of them ship.
      </p>
    </SectionScaffold>
  );
}