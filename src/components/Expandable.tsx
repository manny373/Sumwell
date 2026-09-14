import { useState, type ReactNode } from "react";
import { cn } from "~/lib/cn";
import { ChevronDownIcon } from "~/components/icons";

/**
 * In-place expand/collapse (progressive disclosure) with the a11y surface
 * done once: a real <button> with aria-expanded + aria-controls, and the
 * content region hidden from assistive tech and focus while collapsed.
 */
export function Expandable({
  id,
  summary,
  details,
  children,
  className,
  summaryClassName,
}: {
  /** Unique region id (also used for aria-controls). */
  id: string;
  /** The collapsed summary — a labelled button. */
  summary: ReactNode;
  /** Optional one-line helper shown next to the summary. */
  details?: ReactNode;
  children: ReactNode;
  className?: string;
  summaryClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("rounded-control border border-line-faint", className)}>
      <button
        type="button"
        id={`${id}-trigger`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-sunken/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40",
          summaryClassName,
        )}
      >
        <span className="min-w-0">
          <span className="block text-body-sm font-semibold text-ink">{summary}</span>
          {details ? (
            <span className="mt-0.5 block text-caption text-ink-muted">{details}</span>
          ) : null}
        </span>
        <ChevronDownIcon
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 text-ink-faint transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>
      <div id={id} hidden={!open} className="border-t border-line-faint px-3.5 pb-3 pt-2.5">
        {children}
      </div>
    </div>
  );
}