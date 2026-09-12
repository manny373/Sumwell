import { useId } from "react";
import type { ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "~/lib/cn";
import { ChevronDownIcon } from "~/components/icons";

export type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "className"
> & {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
};

/** Native <select> with the brand styling and an original chevron. */
export function Select({
  label,
  hint,
  error,
  children,
  className,
  id,
  name,
  disabled,
  required,
  ...rest
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={selectId} className="text-body-sm font-medium text-ink">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      <div
        className={cn(
          "relative h-11 rounded-control border transition-colors duration-150",
          "bg-surface-sunken",
          error
            ? "border-danger"
            : "border-line-strong focus-within:border-brand-600 focus-within:bg-surface-raised focus-within:ring-2 focus-within:ring-focus/25",
        )}
      >
        <select
          id={selectId}
          name={name}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-full w-full appearance-none bg-transparent pl-3.5 pr-9 text-body text-ink focus:outline-none",
            disabled && "opacity-60",
          )}
          {...rest}
        >
          {children}
        </select>
        <ChevronDownIcon
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
        />
      </div>
      {hint && !error ? (
        <p id={hintId} className="text-caption text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-caption font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}