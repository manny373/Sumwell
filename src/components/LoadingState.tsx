import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

export type LoadingStateProps = {
  label?: string;
  className?: string;
};

/** Centered spinner with a polite live-region label. */
export function LoadingState({ label = "Loading…", className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 text-ink-muted",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="h-6 w-6 animate-spin rounded-full border-2 border-line-strong border-t-brand-600"
      />
      <p className="text-body-sm">{label}</p>
    </div>
  );
}

/** Skeleton placeholder block (pulse; renders as a static block under reduced motion). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("animate-pulse-soft rounded-card bg-surface-sunken", className)} />
  );
}

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/** Friendly empty / not-yet-available state. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-2 grid h-12 w-12 place-items-center rounded-full bg-brand-100 text-brand-800 dark:bg-brand-100/40 dark:text-brand-900">
          {icon}
        </div>
      ) : null}
      <h3 className="text-h3 text-ink">{title}</h3>
      {description ? (
        <p className="max-w-sm text-body-sm text-ink-muted">{description}</p>
      ) : null}
      {action ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          {action}
        </div>
      ) : null}
    </div>
  );
}