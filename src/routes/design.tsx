import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { cn } from "~/lib/cn";
import { Money } from "~/components/Money";
import { Button, buttonClass } from "~/components/Button";
import { TextField } from "~/components/TextField";
import { Select } from "~/components/Select";
import { Card, CardTitle } from "~/components/Card";
import { Banner } from "~/components/Banner";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { Modal, Sheet } from "~/components/Dialog";
import { Switch } from "~/components/Switch";
import { EmptyState, LoadingState, Skeleton } from "~/components/LoadingState";
import { BarChart, DonutChart, LineChart } from "~/components/charts";
import { Logo } from "~/components/Logo";
import { ThemeToggle, useTheme } from "~/components/theme";
import { THEME_EVENT } from "~/lib/theme";
import {
  TargetIcon,
  WalletIcon,
  LinkIcon,
  DownloadIcon,
} from "~/components/icons";

export const Route = createFileRoute("/design")({
  component: DesignRoute,
});

/* ------------------------------------------------ helpers */

/** Reads a CSS variable's resolved value; re-reads when the theme changes. */
function useCssVar(name: string): string {
  const { resolved } = useTheme();
  const [value, setValue] = useState("");
  useEffect(() => {
    const read = () =>
      setValue(
        getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
      );
    read();
    window.addEventListener(THEME_EVENT, read);
    return () => window.removeEventListener(THEME_EVENT, read);
  }, [name, resolved]);
  return value;
}

function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line pt-10">
      <h2 className="text-h2 text-ink">{title}</h2>
      {intro ? <p className="mt-2 max-w-2xl text-body-sm text-ink-muted">{intro}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Swatch({
  name,
  role,
}: {
  name: string;
  role: string;
}) {
  const value = useCssVar(name);
  return (
    <div className="min-w-28 overflow-hidden rounded-control border border-line bg-surface-raised">
      <div
        className="h-14 w-full border-b border-line-faint"
        style={{ backgroundColor: value || "transparent" }}
        title={value}
      />
      <div className="px-2.5 py-2">
        <p className="truncate font-mono text-caption font-medium text-ink">{name}</p>
        <p className="truncate text-caption text-ink-faint">{role}</p>
        <p className="truncate font-mono text-caption text-ink-faint">{value}</p>
      </div>
    </div>
  );
}

function SwatchRow({
  label,
  names,
  roles,
}: {
  label: string;
  names: readonly string[];
  roles?: readonly string[];
}) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-caption font-semibold uppercase tracking-[0.08em] text-ink-faint">
        {label}
      </p>
      <div className="flex flex-wrap gap-2.5">
        {names.map((n, i) => (
          <Swatch key={n} name={n} role={roles?.[i] ?? ""} />
        ))}
      </div>
    </div>
  );
}

function Specimen({
  token,
  sample,
  note,
}: {
  token: string;
  sample: ReactNode;
  note: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-line-faint py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <div className="sm:w-44">{sample}</div>
      <div className="sm:w-[22rem]">
        <p className="font-mono text-caption text-ink-muted">{token}</p>
        <p className="text-caption text-ink-faint">{note}</p>
      </div>
    </div>
  );
}

function DemoFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-caption font-semibold uppercase tracking-[0.08em] text-ink-faint">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-line-faint bg-surface-sunken/60 p-4">
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------- route */

function DesignRoute() {
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [switchOn, setSwitchOn] = useState(true);
  const [staleVisible, setStaleVisible] = useState(true);

  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-5">
            <Link to="/" aria-label="Sumwell home">
              <Logo />
            </Link>
            <span className="hidden rounded-pill border border-line-strong bg-surface-raised px-2.5 py-1 text-caption font-semibold text-ink-muted sm:inline">
              Design system
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/home" className={buttonClass("ghost", "sm")}>
              App
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-24">
        <div className="py-12">
          <p className="text-caption font-semibold text-brand-700 dark:text-brand-500">
            Sumwell · Milestone A checkpoint
          </p>
          <h1 className="mt-2 text-display text-ink">Design system</h1>
          <p className="mt-4 max-w-2xl text-body text-ink-muted">
            The brand module, tokens, and UI primitives behind the app — shown
            in light and dark. Use the toggle in the header to flip themes;
            every swatch and component below re-resolves from the same CSS
            variables.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              ["#palette", "Palette"],
              ["#type", "Type"],
              ["#spacing", "Spacing"],
              ["#elevation", "Elevation"],
              ["#motion", "Motion"],
              ["#components", "Components"],
              ["#charts", "Charts"],
              ["#a11y", "Accessibility"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-pill border border-line-strong bg-surface-raised px-3 py-1.5 text-caption font-medium text-ink-muted transition-colors hover:border-brand-600 hover:text-brand-700 dark:hover:text-brand-500"
              >
                {label}
              </a>
            ))}
          </div>
        </div>

        <Section
          id="palette"
          title="Palette"
          intro="All values live in src/styles/brand.css under --sw-* variables — light values in :root, dark values in .dark. Utilities resolve from them at runtime, so re-skinning the product is a single-file edit."
        >
          <SwatchRow
            label="Surfaces — warm off-white → warm charcoal"
            names={["--sw-surface", "--sw-surface-raised", "--sw-surface-sunken", "--sw-overlay"]}
            roles={["page background", "cards & bars", "inputs & wells", "dialogs & sheets"]}
          />
          <SwatchRow
            label="Ink — text"
            names={["--sw-ink", "--sw-ink-muted", "--sw-ink-faint", "--sw-ink-inverse"]}
            roles={["primary text", "secondary text", "decorative only", "text on filled controls"]}
          />
          <SwatchRow
            label="Lines"
            names={["--sw-line-faint", "--sw-line", "--sw-line-strong"]}
            roles={["dividers", "borders", "input borders"]}
          />
          <SwatchRow
            label="Brand — deep teal"
            names={[
              "--sw-brand-50", "--sw-brand-100", "--sw-brand-200", "--sw-brand-300",
              "--sw-brand-400", "--sw-brand-500", "--sw-brand-600", "--sw-brand-700",
              "--sw-brand-800", "--sw-brand-900", "--sw-brand-950",
            ]}
            roles={[]}
          />
          <SwatchRow
            label="Accent — restrained green"
            names={["--sw-accent-500", "--sw-accent-600", "--sw-accent-700"]}
            roles={["positive highlights", "check icons", "hover"]}
          />
          <SwatchRow
            label="Status"
            names={[
              "--sw-success", "--sw-success-soft",
              "--sw-warning", "--sw-warning-soft",
              "--sw-danger", "--sw-danger-soft",
              "--sw-info", "--sw-info-soft",
            ]}
            roles={["ok", "attention", "problem", "general info"]}
          />
          <SwatchRow
            label="Focus & scrim"
            names={["--sw-focus", "--sw-scrim"]}
            roles={["keyboard focus ring", "dialog sheet backdrop"]}
          />
        </Section>

        <Section
          id="type"
          title="Type"
          intro="System font stack for speed and reliability; swapping in a variable font later only touches --sw-font-sans. Numerals render with tabular figures so digits align in lists and tables."
        >
          <div className="rounded-card border border-line bg-surface-raised p-5">
            <Specimen token="text-display" note="40px · 700 · -0.02em" sample={<p className="text-display text-ink">Make a clear plan</p>} />
            <Specimen token="text-h1" note="28px · 700" sample={<p className="text-h1 text-ink">Paycheck horizon</p>} />
            <Specimen token="text-h2" note="22px · 600" sample={<p className="text-h2 text-ink">Remaining money</p>} />
            <Specimen token="text-h3" note="18px · 600" sample={<p className="text-h3 text-ink">Next obligation</p>} />
            <Specimen token="text-h4" note="16px · 600" sample={<p className="text-h4 text-ink">Savings goals</p>} />
            <Specimen token="text-body" note="15px · 1.55" sample={<p className="text-body text-ink">Bills, debt, savings, and giving in one calm plan.</p>} />
            <Specimen token="text-body-sm" note="14px · 1.5" sample={<p className="text-body-sm text-ink-muted">Bills, debt, savings, and giving in one calm plan.</p>} />
            <Specimen token="text-caption" note="12px · 500 · +0.01em" sample={<p className="text-caption text-ink-faint">Updated 2 minutes ago</p>} />
            <Specimen
              token="numeric figures · tabular-nums"
              note="Money renders in integer cents with tabular figures"
              sample={
                <div className="flex flex-col gap-1">
                  <Money cents={1845723} className="text-num-xl text-ink" />
                  <Money cents={-25000} options={{ signed: true }} className="text-num-lg text-danger" />
                  <Money cents={250000} options={{ signed: true }} className="text-num-lg text-success" />
                </div>
              }
            />
          </div>
        </Section>

        <Section
          id="spacing"
          title="Spacing & radius"
          intro="Semantic spacing tokens (page, section, card, stack) plus the radius scale. Touch targets stay ≥ 44px."
        >
          <DemoFrame label="Radius scale">
            {[
              ["rounded-none", "0"],
              ["rounded-control", "10px"],
              ["rounded-card", "16px"],
              ["rounded-sheet", "20px"],
              ["rounded-pill", "999px"],
            ].map(([cls, note]) => (
              <div key={cls} className="flex flex-col items-center gap-1.5">
                <div className={cn("h-12 w-12 border border-line-strong bg-brand-100", cls)} />
                <p className="font-mono text-caption text-ink-faint">{note}</p>
              </div>
            ))}
          </DemoFrame>
          <DemoFrame label="Spacing steps (4px base)">
            {[4, 8, 12, 16, 24, 32, 44].map((px) => (
              <div key={px} className="flex flex-col items-center gap-1">
                <div className="w-10 rounded-control bg-brand-300" style={{ height: px }} />
                <p className="font-mono text-caption text-ink-faint">{px}</p>
              </div>
            ))}
          </DemoFrame>
        </Section>

        <Section
          id="elevation"
          title="Elevation"
          intro="Two shadows: card (resting) and pop (dialogs, hovered cards). Both are theme-tokenized (deeper in dark)."
        >
          <div className="flex flex-wrap gap-4">
            <div className="w-44 rounded-card border border-line bg-surface-raised p-5 text-center text-caption text-ink-muted shadow-none">shadow-none</div>
            <div className="w-44 rounded-card border border-line bg-surface-raised p-5 text-center text-caption text-ink-muted shadow-card">shadow-card</div>
            <div className="w-44 rounded-card border border-line bg-surface-raised p-5 text-center text-caption text-ink-muted shadow-pop">shadow-pop</div>
          </div>
        </Section>

        <Section
          id="motion"
          title="Motion"
          intro="Two easing curves give the interface a calm, precise feel. Every animation is killed under prefers-reduced-motion (durations collapse to ~0, end states preserved)."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["fade-in", "200ms", "backdrops, banners"],
              ["rise-in", "280ms", "bottom sheets"],
              ["scale-in", "160ms", "dialogs"],
              ["pulse-soft", "2.4s", "skeleton placeholders"],
            ].map(([name, dur, use]) => (
              <div key={name} className="rounded-card border border-line bg-surface-raised p-4">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-body-sm font-medium text-ink">{name}</p>
                  <p className="text-caption text-ink-faint">{dur}</p>
                </div>
                <p className="mt-1 text-caption text-ink-muted">{use}</p>
                <span
                  aria-hidden="true"
                  className="mt-3 inline-block h-2 w-16 animate-fade-in rounded-pill bg-brand-500"
                />
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="components"
          title="Components"
          intro="Every primitive is keyboard-usable, labelled, and contrast-checked (see Accessibility below)."
        >
          <DemoFrame label="Buttons — variants">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
          </DemoFrame>
          <DemoFrame label="Buttons — sizes & states">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
            <Button loading>Saving…</Button>
          </DemoFrame>

          <DemoFrame label="Text field — default, prefix, error, hint, disabled">
            <div className="w-full max-w-xs">
              <TextField label="Monthly rent" prefix="$" numeric placeholder="0.00" hint="Used as an essential obligation." />
            </div>
            <div className="w-full max-w-xs">
              <TextField label="Paycheck amount" prefix="$" numeric defaultValue="1850.00" error="Must be more than 0." />
            </div>
            <div className="w-full max-w-xs">
              <TextField label="Nickname" placeholder="e.g. Everyday checking" disabled />
            </div>
          </DemoFrame>
          <DemoFrame label="Select">
            <div className="w-full max-w-xs">
              <Select label="Pay-from account" defaultValue="checking">
                <option value="checking">Everyday checking</option>
                <option value="savings">Rainy-day savings</option>
                <option value="alt">Alternate checking</option>
              </Select>
            </div>
          </DemoFrame>

          <DemoFrame label="Switch">
            <Switch checked={switchOn} onChange={setSwitchOn} label="Automation preview (simulated)" />
            <Switch checked={false} onChange={() => {}} label="Paused rule" />
            <Switch checked={true} onChange={() => {}} label="Disabled switch" disabled />
          </DemoFrame>

          <DemoFrame label="Cards">
            <Card className="max-w-xs">
              <CardTitle>Everyday checking</CardTitle>
              <Money cents={1845723} className="mt-2 text-num-lg text-ink" />
              <p className="mt-1 text-caption text-ink-faint">Updated 2 minutes ago · demo connection</p>
            </Card>
            <Card interactive className="max-w-xs" >
              <CardTitle>Save for emergency fund</CardTitle>
              <p className="mt-1 text-body-sm text-ink-muted">Interactive card — hover raises it.</p>
            </Card>
          </DemoFrame>

          <DemoFrame label="Banners">
            <div className="flex w-full max-w-md flex-col gap-3">
              <Banner variant="info" title="Estimate" description="Remaining money assumes your next paycheck arrives on time. Income is not final until received." />
              <Banner variant="warning" title="Shortfall ahead" description="Planned spending exceeds available funds on Sep 21 by $42.18." />
              <Banner variant="error" title="Couldn’t load balances" description="Check the connection and retry." action={<Button size="sm" variant="secondary">Retry</Button>} />
              {staleVisible ? (
                <Banner variant="stale" title="Data may be out of date" description="Last synced 31 days ago for this demo account." onDismiss={() => setStaleVisible(false)} />
              ) : null}
              <Banner variant="success" title="Goal funded" description="Emergency fund passed 50% of target." />
            </div>
          </DemoFrame>

          <DemoFrame label="Dialogs">
            <Button onClick={() => setModalOpen(true)}>Open modal</Button>
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>Open sheet</Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmLoading(false);
                setConfirmOpen(true);
              }}
            >
              Open confirm
            </Button>
          </DemoFrame>

          <DemoFrame label="Feedback states">
            <Card padded={false} className="w-full max-w-md">
              <EmptyState
                icon={<TargetIcon className="h-6 w-6" />}
                title="No goals yet"
                description="Add an emergency fund or a custom goal, then build a plan around it."
                action={<Button size="sm">Add a goal</Button>}
              />
            </Card>
            <div className="w-full max-w-sm">
              <LoadingState label="Checking balances…" />
            </div>
            <div className="flex w-full max-w-sm flex-col gap-2">
              <Skeleton className="h-24" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </DemoFrame>

          <DemoFrame label="Empty icon tiles (used in nav & placeholders)">
            <span className="grid h-10 w-10 place-items-center rounded-control bg-brand-100 text-brand-800 dark:bg-brand-100/40 dark:text-brand-900">
              <WalletIcon className="h-5 w-5" />
            </span>
            <span className="grid h-10 w-10 place-items-center rounded-control bg-accent-100 text-accent-800 dark:bg-accent-100/40 dark:text-accent-900">
              <LinkIcon className="h-5 w-5" />
            </span>
            <span className="grid h-10 w-10 place-items-center rounded-control bg-danger-soft text-danger">
              <DownloadIcon className="h-5 w-5" />
            </span>
          </DemoFrame>
        </Section>

        <Section
          id="charts"
          title="Charts"
          intro="Restrained SVG primitives — no chart library, token colors, aria-labelled. They’ll carry the paycheck horizon, goals, and history."
        >
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardTitle>Projected spending by week</CardTitle>
              <BarChart
                className="mt-4"
                ariaLabel="Projected spending by week: starting at 428, then 615, 510, and 449 dollars"
                data={[
                  { label: "W1", value: 42800 },
                  { label: "W2", value: 61500 },
                  { label: "W3", value: 51000 },
                  { label: "W4", value: 44900 },
                ]}
                highlightIndex={1}
              />
              <div className="mt-2 flex justify-between text-caption text-ink-faint">
                <span>W1</span><span>W2</span><span>W3</span><span>W4</span>
              </div>
            </Card>
            <Card>
              <CardTitle>Emergency fund</CardTitle>
              <div className="mt-4 flex items-center gap-5">
                <DonutChart value={285000} max={500000} ariaLabel="Emergency fund is 57 percent funded">
                  <div className="text-center">
                    <p className="text-num-lg text-ink">57%</p>
                    <p className="text-caption text-ink-faint">of $5,000</p>
                  </div>
                </DonutChart>
                <div className="flex flex-col gap-1">
                  <p className="text-caption text-ink-faint">Saved</p>
                  <Money cents={285000} className="text-num text-ink" />
                  <p className="text-caption text-ink-faint">Target</p>
                  <Money cents={500000} className="text-num text-ink" />
                </div>
              </div>
            </Card>
            <Card className="md:col-span-2">
              <CardTitle>Available balance trend</CardTitle>
              <LineChart
                className="mt-4"
                ariaLabel="Available balance over eight weeks, ending near 1,600 dollars"
                points={[182000, 175400, 168900, 161200, 154800, 159300, 152100, 159800]}
                labels={["Sep 4", "Sep 11", "Sep 18", "Sep 25", "Oct 2", "Oct 9", "Oct 16", "Oct 23"]}
                showDots
              />
            </Card>
          </div>
        </Section>

        <Section
          id="a11y"
          title="Accessibility"
          intro="The primitives are built to be usable, not just visible."
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              ["Keyboard", "Every control focusable; dialogs trap focus and close on Esc; Switch responds to Space/Enter; focus ring is a visible 2px token outline."],
              ["Screen readers", "Labels wired with aria-labelledby/describedby; banners use status/alert roles; charts and icons carry aria-labels; skip-to-content link in the shell."],
              ["Contrast", "Body text ≥ 7:1, muted text ≥ 4.5:1 on its surface; status colors checked against both themes; focus ring visible in light and dark."],
              ["Reduced motion", "All animation collapses to ~0 duration under prefers-reduced-motion; nothing critical animates."],
              ["Touch targets", "Controls are ≥ 40px tall (h-10), primary actions h-12, bottom-nav targets ≥ 44px; safe-area padding on mobile."],
              ["Text size", "All type uses rem; layout reflows to a single column on small screens and to a sidebar layout on lg+."],
            ].map(([title, body]) => (
              <li key={title} className="rounded-card border border-line bg-surface-raised p-4">
                <p className="text-h4 text-ink">{title}</p>
                <p className="mt-1.5 text-body-sm text-ink-muted">{body}</p>
              </li>
            ))}
          </ul>
        </Section>

        <footer className="mt-14 border-t border-line pt-8 pb-6 text-caption text-ink-faint">
          <p>
            Tokens: <span className="font-mono">src/styles/brand.css</span> ·
            Primitives: <span className="font-mono">src/components/</span> ·
            Route: <span className="font-mono">/design</span>
          </p>
          <p className="mt-1">
            Sumwell prototype — synthetic demo data; not a production financial service.
          </p>
        </footer>
      </main>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Modal demo" footer={<Button onClick={() => setModalOpen(false)}>Done</Button>}>
        <p className="text-body text-ink-muted">
          A centered dialog. Tab cycles inside it, Esc or backdrop dismisses it,
          and focus returns to the opener when it closes.
        </p>
      </Modal>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Sheet demo" footer={<Button onClick={() => setSheetOpen(false)}>Done</Button>}>
        <p className="text-body text-ink-muted">
          The mobile-first bottom sheet. Drag-free but Esc/backdrop/button
          dismissible, with focus trapped inside.
        </p>
        <div className="mt-4">
          <TextField label="Sheet input" placeholder="Focus me with Tab" />
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Remove this connection?"
        body="Accounts won’t re-sync until you reconnect. Transaction history stays on this device in the demo."
        confirmLabel="Remove connection"
        onConfirm={() => {
          setConfirmLoading(true);
          window.setTimeout(() => {
            setConfirmLoading(false);
            setConfirmOpen(false);
          }, 900);
        }}
        loading={confirmLoading}
      />
    </div>
  );
}