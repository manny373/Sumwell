import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { buttonClass } from "~/components/Button";
import { Card } from "~/components/Card";
import { EmptyState } from "~/components/LoadingState";
import { CheckIcon } from "~/components/icons";

/**
 * Phase-2 tab placeholder: consistent header + what this tab will contain.
 * Full screen flows are intentionally out of scope for Phase 1.
 */
export function Placeholder({
  icon,
  title,
  description,
  items,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <span className="inline-flex w-fit items-center gap-2 rounded-pill border border-line-strong bg-surface-raised px-2.5 py-1 text-caption font-semibold text-ink-muted">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          Prototype · Phase 2
        </span>
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-brand-100 text-brand-800 dark:bg-brand-100/40 dark:text-brand-900">
            {icon}
          </span>
          <h1 className="text-h1 text-ink">{title}</h1>
        </div>
        <p className="max-w-lg text-body text-ink-muted">{description}</p>
      </header>

      <Card>
        <EmptyState
          icon={icon}
          title={`${title} arrives in Phase 2`}
          description="This phase built the design system, app shell, and routing. This tab is a scaffolded placeholder until the flow is built."
          action={
            <Link to="/design" className={buttonClass("secondary", "sm")}>
              View the design system
            </Link>
          }
        />
      </Card>

      <section aria-label={`What ${title} will include`}>
        <h2 className="text-h4 text-ink">Planned for this tab</h2>
        <ul className="mt-3 flex flex-col gap-2.5">
          {items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 text-body-sm text-ink-muted"
            >
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-600 dark:text-accent-500" />
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}