import { Link, Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card } from "~/components/Card";
import { LoadingState } from "~/components/LoadingState";
import { Logo } from "~/components/Logo";
import { ThemeToggle } from "~/components/theme";
import { useClientData } from "~/lib/client/store";
import { HonestyChips } from "~/components/app/HonestyChips";
import { ChevronRightIcon } from "~/components/icons";

export const Route = createFileRoute("/")({
  component: OnboardingRoute,
});

/**
 * Founder direction (2026-09-12): the FIRST visit lands in onboarding, not the
 * landing page. After onboarding completes, / routes to Home. The landing
 * page lives on at /landing and the /design styleguide stays reachable.
 */
function OnboardingRoute() {
  const { status, onboarded } = useClientData();

  if (status !== "ready") {
    return (
      <main className="grid min-h-dvh place-items-center bg-surface">
        <LoadingState label="Getting ready…" />
      </main>
    );
  }
  if (onboarded) {
    return <Navigate to="/home" replace />;
  }
  return <OnboardingChooser />;
}

function OnboardingChooser() {
  const navigate = useNavigate();
  const { loadDemo } = useClientData();

  return (
    <main className="relative flex min-h-dvh flex-col items-center overflow-hidden bg-surface px-6 py-12">
      {/* Soft ambient color fields (decorative, aria-hidden). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-36 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-brand-200/50 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 -right-24 h-96 w-96 rounded-full bg-accent-200/40 blur-3xl"
      />

      <div className="relative flex w-full max-w-xl flex-1 flex-col items-center justify-center">
        <Logo />
        <h1 className="mt-8 text-center text-display text-ink">
          Make a clear plan for{" "}
          <span className="text-brand-700 dark:text-brand-500">every paycheck</span>.
        </h1>
        <p className="mt-4 max-w-md text-center text-body text-ink-muted">
          Start with a few numbers — no bank connection, no logins, no real
          money. Everything here is a prototype.
        </p>

        <div className="mt-8 w-full max-w-sm">
          <Card interactive padded={false} className="overflow-hidden">
            <button
              type="button"
              onClick={() => {
                loadDemo();
                void navigate({ to: "/home" });
              }}
              className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-surface-sunken"
            >
              <div>
                <p className="text-h4 text-ink">Try the demo</p>
                <p className="mt-1 text-body-sm text-ink-muted">
                  A ready-made household with synthetic data — one tap.
                </p>
              </div>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-faint" />
            </button>
          </Card>
          <Card interactive padded={false} className="mt-3 overflow-hidden">
            <Link
              to="/setup"
              className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-surface-sunken"
            >
              <div>
                <p className="text-h4 text-ink">Enter a few numbers</p>
                <p className="mt-1 text-body-sm text-ink-muted">
                  Your pay date, bills, and what this check should cover.
                </p>
              </div>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-faint" />
            </Link>
          </Card>
        </div>

        <div className="mt-8">
          <HonestyChips />
        </div>

        <p className="mt-8 text-caption text-ink-faint">
          Sumwell prototype — not a production financial service. No bank
          passwords are ever asked for. All data stays on this device.
        </p>
        <div className="mt-6 flex items-center gap-4">
          <a href="/design" className="text-caption font-medium text-ink-muted hover:text-ink">
            Design system
          </a>
          <a href="/landing" className="text-caption font-medium text-ink-muted hover:text-ink">
            Landing page
          </a>
          <ThemeToggle />
        </div>
      </div>
    </main>
  );
}