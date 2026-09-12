import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

export type CardProps = {
  children: ReactNode;
  className?: string;
  /** Adds hover elevation + pointer cursor (for clickable cards). */
  interactive?: boolean;
  /** Inner padding. Default true. */
  padded?: boolean;
};

export function Card({ children, className, interactive = false, padded = true }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-line bg-surface-raised shadow-card",
        padded && "p-card",
        interactive && "cursor-pointer transition-shadow duration-150 hover:shadow-pop",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h3 className={cn("text-h3 text-ink", className)}>{children}</h3>;
}