import { cn } from "~/lib/cn";

/**
 * Sumwell logo — stacked bars read as “a growing sum”. The mark uses brand
 * tokens only, so it re-skins with the brand module.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-brand-600 text-ink-inverse"
        aria-hidden="true"
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none">
          <rect x="4" y="12.5" width="5.5" height="3" rx="1.5" fill="currentColor" />
          <rect x="4" y="8.5" width="9" height="3" rx="1.5" fill="currentColor" />
          <rect x="4" y="4.5" width="12.5" height="3" rx="1.5" fill="currentColor" />
        </svg>
      </span>
      <span className="text-h4 font-semibold tracking-tight text-ink">
        Sumwell
      </span>
    </span>
  );
}