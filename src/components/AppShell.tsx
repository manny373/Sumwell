import { useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "~/lib/cn";
import { Logo } from "~/components/Logo";
import { ThemeToggle } from "~/components/theme";
import { AboutDemoSheet } from "~/components/AboutDemoSheet";
import { useClientData } from "~/lib/client/store";
import {
  HomeIcon,
  MoreIcon,
  PlanIcon,
  ProgressIcon,
} from "~/components/icons";

const TABS = [
  { id: "home", label: "Home", href: "/home", icon: HomeIcon },
  { id: "plan", label: "Plan", href: "/plan", icon: PlanIcon },
  { id: "progress", label: "Progress", href: "/progress", icon: ProgressIcon },
  { id: "more", label: "More", href: "/more", icon: MoreIcon },
] as const;

export type TabId = (typeof TABS)[number]["id"];

/**
 * The ONE persistent demo/data indicator (Finding 9). Shows "Demo data" for
 * the synthetic household, "Your data" for manual numbers, and opens the
 * "About this demo" sheet where every repeated explanation lives. Screens do
 * NOT repeat the demo warnings themselves.
 */
function DataChip({ onOpen }: { onOpen: () => void }) {
  const { household } = useClientData();
  const demo = household?.source === "demo";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center gap-1.5 rounded-pill border border-warning/40 bg-warning-soft px-2.5 py-1 text-caption font-semibold text-warning transition-colors hover:border-warning/60 hover:bg-warning-soft/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
    >
      {demo ? "Demo data" : "Your data"}
      <span className="underline decoration-warning/50 underline-offset-2">about</span>
    </button>
  );
}

function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-raised/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="grid grid-cols-4">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            to={tab.href}
            activeProps={{ "aria-current": "page", className: "text-brand-700 dark:text-brand-900" }}
            inactiveProps={{ className: "text-ink-faint hover:text-ink-muted" }}
            className="flex flex-col items-center gap-1 py-2.5 text-caption font-medium transition-colors duration-150"
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "grid h-7 w-14 place-items-center rounded-pill transition-colors duration-150",
                    isActive && "bg-brand-100/70 dark:bg-brand-100/30",
                  )}
                >
                  <tab.icon className="h-5 w-5" />
                </span>
                {tab.label}
              </>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function Sidebar({ onOpenAbout }: { onOpenAbout: () => void }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-surface-raised px-3 py-5 lg:flex">
      <div className="flex items-center justify-between gap-2 px-1.5">
        <Link to="/" aria-label="Sumwell home">
          <Logo />
        </Link>
        <DataChip onOpen={onOpenAbout} />
      </div>
      <nav aria-label="Primary" className="mt-9 flex flex-col gap-1">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            to={tab.href}
            activeProps={{
              "aria-current": "page",
              className:
                "bg-brand-100/60 text-brand-900 dark:bg-brand-100/30 dark:text-brand-900",
            }}
            inactiveProps={{
              className: "text-ink-muted hover:bg-surface-sunken hover:text-ink",
            }}
            className="flex items-center gap-3 rounded-control px-3 py-2.5 text-body-sm font-medium transition-colors duration-150"
          >
            <tab.icon className="h-5 w-5" />
            {tab.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
        <div className="flex items-center justify-between px-1.5">
          <button
            type="button"
            onClick={onOpenAbout}
            className="text-caption font-semibold text-ink-faint underline-offset-2 transition-colors hover:text-ink-muted hover:underline"
          >
            About this demo
          </button>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

function MobileHeader({ onOpenAbout }: { onOpenAbout: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
      <Link to="/" aria-label="Sumwell home">
        <Logo />
      </Link>
      <div className="flex items-center gap-2.5">
        <DataChip onOpen={onOpenAbout} />
        <ThemeToggle />
      </div>
    </header>
  );
}

/**
 * App shell: sticky mobile header, bottom navigation (4 tabs) on small
 * screens, and a matching sidebar on lg+ screens. Content is rendered in a
 * centered column below. One persistent demo indicator + the "About this
 * demo" sheet live here so screens don't repeat the warnings (Finding 9).
 */
export function AppShell({
  children,
  active,
}: {
  children: ReactNode;
  /** Optional explicit active tab; defaults to the current pathname. */
  active?: TabId;
}) {
  const { pathname } = useLocation();
  const { household } = useClientData();
  const [aboutOpen, setAboutOpen] = useState(false);

  const activeTab: TabId =
    active ??
    (TABS.find(
      (t) => pathname === t.href || pathname.startsWith(`${t.href}/`),
    )?.id ?? "home");

  return (
    <div className="min-h-dvh bg-surface">
      <a
        href="#app-main"
        className="sr-only rounded-control bg-brand-600 px-4 py-2 text-body-sm font-semibold text-ink-inverse focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>
      <Sidebar onOpenAbout={() => setAboutOpen(true)} />
      <MobileHeader onOpenAbout={() => setAboutOpen(true)} />
      <main
        id="app-main"
        className="px-4 pb-28 pt-5 lg:pl-68 lg:pr-8 lg:pb-16 lg:pt-8"
      >
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>
      <BottomNav />
      {/* Hidden hint keeps the active tab readable to screen readers on route change. */}
      <span className="sr-only" aria-live="polite">
        {activeTab === "home" ? "" : `${activeTab} tab`}
      </span>
      <AboutDemoSheet
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        sourceIsDemo={household?.source === "demo"}
      />
    </div>
  );
}