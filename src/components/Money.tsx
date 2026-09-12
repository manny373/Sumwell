import { formatCents, type MoneyOptions } from "~/lib/money";
import { cn } from "~/lib/cn";

/**
 * Money — renders integer cents as USD with tabular figures so numerals in
 * lists and tables align. Always deterministic (see lib/money).
 */
export function Money({
  cents,
  options,
  className,
}: {
  cents: number;
  options?: MoneyOptions;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", className)}>{formatCents(cents, options)}</span>
  );
}