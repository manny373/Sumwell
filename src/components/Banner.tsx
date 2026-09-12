import type { ReactNode } from "react";
import { cn } from "~/lib/cn";
import {
  CheckCircleIcon,
  ClockIcon,
  InfoIcon,
  WarningIcon,
  XCircleIcon,
  XIcon,
} from "~/components/icons";

export type BannerVariant = "info" | "warning" | "error" | "stale" | "success";

const VARIANT_STYLES: Record<
  BannerVariant,
  { wrap: string; icon: ReactNode; role: "status" | "alert" }
> = {
  info: {
    wrap: "border-info/30 bg-info-soft text-info",
    icon: <InfoIcon className="h-4.5 w-4.5" />,
    role: "status",
  },
  warning: {
    wrap: "border-warning/30 bg-warning-soft text-warning",
    icon: <WarningIcon className="h-4.5 w-4.5" />,
    role: "status",
  },
  error: {
    wrap: "border-danger/30 bg-danger-soft text-danger",
    icon: <XCircleIcon className="h-4.5 w-4.5" />,
    role: "alert",
  },
  stale: {
    wrap: "border-line-strong bg-surface-sunken text-ink-muted",
    icon: <ClockIcon className="h-4.5 w-4.5" />,
    role: "status",
  },
  success: {
    wrap: "border-success/30 bg-success-soft text-success",
    icon: <CheckCircleIcon className="h-4.5 w-4.5" />,
    role: "status",
  },
};

export type BannerProps = {
  variant?: BannerVariant;
  title: string;
  description?: string;
  /** Optional trailing action (e.g. a small Button). */
  action?: ReactNode;
  /** Shows a dismiss button and calls this when pressed. */
  onDismiss?: () => void;
  className?: string;
};

export function Banner({
  variant = "info",
  title,
  description,
  action,
  onDismiss,
  className,
}: BannerProps) {
  const style = VARIANT_STYLES[variant];
  return (
    <div
      role={style.role}
      className={cn(
        "flex items-start gap-3 rounded-card border p-3.5",
        style.wrap,
        className,
      )}
    >
      <span className="mt-0.5 shrink-0 [&>svg]:h-4.5 [&>svg]:w-4.5">{style.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-semibold leading-snug">{title}</p>
        {description ? (
          <p className="mt-0.5 text-body-sm text-ink-muted">{description}</p>
        ) : null}
        {action ? <div className="mt-2.5">{action}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-control text-current/70 transition-colors hover:bg-current/10"
        >
          <XIcon className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}