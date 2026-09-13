/**
 * Settings — Phase 3d. Editable assumptions (reuses the /setup prefill path),
 * theme toggle, demo/manual switch, export (reuses ExportSheet), and a
 * destructive start-over with a confirm dialog.
 */
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Banner } from "~/components/Banner";
import { Button, buttonClass } from "~/components/Button";
import { Card } from "~/components/Card";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { ExportSheet } from "~/components/more/ExportSheet";
import { ThemeToggle } from "~/components/theme";
import { DownloadIcon, PencilIcon, TrashIcon } from "~/components/icons";
import { useClientData } from "~/lib/client/store";
import { STORAGE_KEY } from "~/lib/client/storage";
import type { Household } from "~/lib/client/types";
import { SectionScaffold } from "./SectionScaffold";

function Row({
  label,
  value,
  action,
}: {
  label: string;
  value?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-body-sm font-medium text-ink">{label}</p>
        {value ? <p className="mt-0.5 text-caption text-ink-muted">{value}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function SettingsView({
  household,
  onBack,
}: {
  household: Household;
  onBack: () => void;
}) {
  const { loadDemo, startOver } = useClientData();
  const navigate = useNavigate();
  const [exportOpen, setExportOpen] = useState(false);
  const [startOverOpen, setStartOverOpen] = useState(false);
  const [demoSwitchOpen, setDemoSwitchOpen] = useState(false);

  const doStartOver = () => {
    setStartOverOpen(false);
    startOver();
    void navigate({ to: "/" });
  };

  const doSwitchToDemo = () => {
    setDemoSwitchOpen(false);
    loadDemo();
    void navigate({ to: "/home" });
  };

  const created = new Date(household.createdAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <SectionScaffold
      title="Settings"
      subtitle="Your assumptions, appearance, and data — all local to this device."
      onBack={onBack}
    >
      <div className="flex flex-col gap-4">
        <section aria-labelledby="settings-assumptions">
          <h2 id="settings-assumptions" className="text-h3 text-ink">
            Your numbers & assumptions
          </h2>
          <Card className="mt-2.5">
            <Row
              label="Plan assumptions"
              value="Pay date, net pay, bills, essentials, buffer, goals, and giving — prefilled with your current numbers."
              action={
                <Link to="/setup" className={buttonClass("secondary", "sm")}>
                  <PencilIcon className="h-4 w-4" />
                  Edit assumptions
                </Link>
              }
            />
            <div className="border-t border-line-faint" />
            <Row
              label="Data source"
              value={
                household.source === "demo"
                  ? "The labeled demo household (synthetic)."
                  : "Numbers you entered by hand — nothing connected."
              }
            />
            <div className="border-t border-line-faint" />
            <Row
              label="Created"
              value={created}
            />
            <div className="border-t border-line-faint" />
            <Row
              label="Saved on this device"
              value={`localStorage key: ${STORAGE_KEY} — nothing is stored anywhere else.`}
            />
          </Card>
        </section>

        <section aria-labelledby="settings-appearance">
          <h2 id="settings-appearance" className="text-h3 text-ink">
            Appearance
          </h2>
          <Card className="mt-2.5">
            <Row
              label="Theme"
              value="Light or dark — saved for next visit."
              action={<ThemeToggle />}
            />
          </Card>
        </section>

        <section aria-labelledby="settings-data">
          <h2 id="settings-data" className="text-h3 text-ink">
            Data
          </h2>
          <Card className="mt-2.5">
            <Row
              label="Switch to the demo household"
              value={
                household.source === "demo"
                  ? "You're already using the demo household. To use your own numbers, edit assumptions above."
                  : "Replaces your entered numbers with the labeled synthetic demo household."
              }
              action={
                household.source === "demo" ? (
                  <Link to="/setup" className={buttonClass("secondary", "sm")}>
                    Enter your own numbers
                  </Link>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setDemoSwitchOpen(true)}
                  >
                    Switch to demo
                  </Button>
                )
              }
            />
            <div className="border-t border-line-faint" />
            <Row
              label="Export everything"
              value="Download your current data as a JSON backup or transactions as CSV — plain files, nothing sent anywhere."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setExportOpen(true)}
                >
                  <DownloadIcon className="h-4 w-4" />
                  Export
                </Button>
              }
            />
          </Card>

          <Card className="mt-3 border-danger/30 bg-danger-soft/40">
            <Row
              label="Start over"
              value="Wipes all prototype data from this device and returns to the beginning."
              action={
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setStartOverOpen(true)}
                >
                  <TrashIcon className="h-4 w-4" />
                  Start over
                </Button>
              }
            />
          </Card>
          <p className="mt-2 text-caption leading-relaxed text-ink-faint">
            Start over = delete: it clears the {STORAGE_KEY} key and only that.
            There is no cloud copy of your data in this prototype.
          </p>
        </section>
      </div>

      {/* destructive / replacement confirms */}
      <ConfirmDialog
        open={startOverOpen}
        onClose={() => setStartOverOpen(false)}
        title="Start over?"
        body="All prototype data on this device will be erased and you'll return to the beginning. This cannot be undone."
        confirmLabel="Start over"
        onConfirm={doStartOver}
      />
      <ConfirmDialog
        open={demoSwitchOpen}
        onClose={() => setDemoSwitchOpen(false)}
        title="Replace your numbers with the demo household?"
        body="Your manually entered numbers will be replaced by the labeled synthetic demo household. Your current data is wiped from this device — export it first if you want a copy."
        confirmLabel="Switch to demo"
        onConfirm={doSwitchToDemo}
        tone="primary"
      />
      <ExportSheet
        open={exportOpen}
        household={household}
        onClose={() => setExportOpen(false)}
      />
      {/* The plan's SourceChip convention keeps demo framing visible on every tab. */}
      <Banner
        variant="stale"
        title="Everything here is prototype data"
        description="Synthetic or hand-entered, local only. No bank connection, no real money — and no way to change that in Milestone A."
      />
    </SectionScaffold>
  );
}