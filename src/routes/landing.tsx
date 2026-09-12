import { Link, createFileRoute } from "@tanstack/react-router";
import { buttonClass } from "~/components/Button";
import { Logo } from "~/components/Logo";
import { ThemeToggle } from "~/components/theme";

export const Route = createFileRoute("/landing")({
  component: Landing,
});

/**
 * Retired landing page — the first visit now routes straight into onboarding
 * (founder direction 2026-09-12). Kept reachable at /landing.
 */
const CHIPS = ["Synthetic demo data", "No bank connections", "Prototype"];

function Landing() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-surface px-6 py-16 text-center">
      {/* Soft ambient color fields (decorative, aria-hidden). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-brand-200/50 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 -right-24 h-96 w-96 rounded-full bg-accent-200/40 blur-3xl"
      />

      <div className="relative flex flex-col items-center">
        <Link to="/" aria-label="Sumwell — start the prototype">
          <Logo />
        </Link>

        <h1 className="mt-10 max-w-xl text-display text-ink">
          Make a clear plan for{" "}
          <span className="text-brand-700 dark:text-brand-500">every paycheck</span>.
        </h1>
        <p className="mt-5 max-w-md text-body text-ink-muted">
          Sumwell brings bills, debt, savings, and giving into one calm plan —
          built around the days you get paid.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link to="/" className={buttonClass("primary", "lg")}>
            Start the prototype
          </Link>
          <Link to="/design" className={buttonClass("secondary", "lg")}>
            See the design system
          </Link>
        </div>

        <ul className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {CHIPS.map((chip) => (
            <li
              key={chip}
              className="rounded-pill border border-line bg-surface-raised px-3 py-1 text-caption font-medium text-ink-muted"
            >
              {chip}
            </li>
          ))}
        </ul>

        <div className="mt-14 flex items-center gap-4">
          <ThemeToggle />
          <p className="text-caption text-ink-faint">
            Sumwell prototype — not a production financial service.
          </p>
        </div>
      </div>
    </main>
  );
}