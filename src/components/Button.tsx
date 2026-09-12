import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "~/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Shared button classes — exported so links (<a>) can render as buttons
 * without nesting interactive elements.
 */
export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold",
    "transition-colors duration-150",
    "disabled:pointer-events-none disabled:opacity-50",
    size === "sm" && "h-8 px-3 text-body-sm",
    size === "md" && "h-10 px-4 text-body-sm",
    size === "lg" && "h-12 px-5 text-body",
    variant === "primary" &&
      "bg-brand-600 text-ink-inverse hover:bg-brand-700 active:bg-brand-800",
    variant === "secondary" &&
      "border border-line-strong bg-surface-raised text-ink hover:bg-surface-sunken active:bg-surface-sunken",
    variant === "ghost" &&
      "text-ink-muted hover:bg-surface-sunken hover:text-ink active:text-ink",
    variant === "destructive" &&
      "bg-danger text-ink-inverse hover:bg-danger/90 active:bg-danger/80",
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows an inline spinner and disables the button. */
  loading?: boolean;
  children?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={buttonClass(variant, size, className)}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current/25 border-t-current"
        />
      ) : null}
      {children}
    </button>
  );
}