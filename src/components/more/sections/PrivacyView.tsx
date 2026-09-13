/**
 * Privacy — Phase 3d. Plain-language truth about the prototype's data:
 * synthetic or manually entered, stored ONLY in this browser under the
 * "sumwell:v1" localStorage key, sent nowhere, no bank credentials requested,
 * and "delete data" = "start over".
 */
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Banner } from "~/components/Banner";
import { Button } from "~/components/Button";
import { Card } from "~/components/Card";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { useClientData } from "~/lib/client/store";
import { STORAGE_KEY } from "~/lib/client/storage";
import { SectionScaffold } from "./SectionScaffold";

const POINTS: Array<{ title: string; body: string }> = [
  {
    title: "What data exists",
    body: "Only two kinds of data are ever in this app: the built-in demo household (clearly labeled synthetic) or numbers you typed yourself. There is no data from a bank, a credit bureau, or any other service — nothing is connected.",
  },
  {
    title: "Where it lives",
    body: "Everything is saved only in this browser's local storage under one key, sumwell:v1. There is no account, no login, and no server copy. Clearing your browser data — or private-browsing mode — removes it.",
  },
  {
    title: "What is sent anywhere",
    body: "Nothing. The prototype makes no network calls with your data and loads no analytics or third-party scripts. The only way data leaves this device at all is the Export action, which downloads a plain file that you choose to keep or discard.",
  },
  {
    title: "Bank credentials",
    body: "Sumwell never asks for a bank password, PIN, or Social Security number — not in this prototype, not by design, ever. Real connections would use secure redirects to your bank, never a password field here. If you ever see one, don't fill it in.",
  },
  {
    title: "Deleting your data",
    body: "Deleting is the same as starting over: it wipes the local storage key completely. There is nothing anywhere else to delete, because nothing was ever sent anywhere.",
  },
];

export function PrivacyView({
  onBack,
  onDeleted,
}: {
  onBack: () => void;
  /** Called after data is wiped (privacy → onboarding start). */
  onDeleted: () => void;
}) {
  const { startOver } = useClientData();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const deleteAndStartOver = () => {
    setConfirmOpen(false);
    startOver();
    void navigate({ to: "/" });
    onDeleted();
  };

  return (
    <SectionScaffold
      title="Privacy"
      subtitle="In plain language: what data this prototype holds and what never leaves your device."
      onBack={onBack}
    >
      <Banner
        variant="info"
        title="Prototype privacy, not product promises"
        description="This describes the Milestone A prototype. A real service would need its own policy, encryption, retention rules, and a real privacy review — none of that exists yet."
      />
      <div className="flex flex-col gap-3">
        {POINTS.map((point, index) => (
          <Card key={point.title}>
            <p className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-faint">
              {String(index + 1).padStart(2, "0")}
            </p>
            <h2 className="mt-1 text-h4 text-ink">{point.title}</h2>
            <p className="mt-1.5 text-body-sm leading-relaxed text-ink-muted">
              {point.body}
            </p>
          </Card>
        ))}
      </div>

      <Card className="border-danger/30 bg-danger-soft/40">
        <h2 className="text-h4 text-ink">Delete my data</h2>
        <p className="mt-1 text-body-sm leading-relaxed text-ink-muted">
          Wipes the <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-caption">{STORAGE_KEY}</code>{" "}
          key from this browser and returns to the start. Nothing else exists
          to delete.
        </p>
        <Button
          variant="destructive"
          size="sm"
          className="mt-3"
          onClick={() => setConfirmOpen(true)}
        >
          Delete data and start over
        </Button>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete all prototype data?"
        body={
          <>
            Everything you typed or loaded on this device (local storage key{" "}
            <code className="rounded bg-surface-sunken px-1 py-0.5 text-caption">{STORAGE_KEY}</code>)
            will be erased. This cannot be undone — there is no copy anywhere
            else.
          </>
        }
        confirmLabel="Delete and start over"
        onConfirm={deleteAndStartOver}
      />
    </SectionScaffold>
  );
}