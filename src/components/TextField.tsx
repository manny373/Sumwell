import { useId } from "react";
import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

export type TextFieldProps = {
  label: string;
  id?: string;
  hint?: string;
  error?: string;
  /** Static adornment before the value, e.g. "$". */
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** Right-aligned + tabular figures + decimal input mode for money. */
  numeric?: boolean;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  type?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  autoComplete?: string;
  className?: string;
};

export function TextField({
  label,
  id,
  hint,
  error,
  prefix,
  suffix,
  numeric = false,
  placeholder,
  value,
  defaultValue,
  onChange,
  type = "text",
  disabled,
  required,
  name,
  autoComplete,
  className,
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-body-sm font-medium text-ink">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      <div
        className={cn(
          "flex h-11 items-center gap-2 rounded-control border px-3.5 transition-colors duration-150",
          "bg-surface-sunken",
          error
            ? "border-danger"
            : "border-line-strong focus-within:border-brand-600 focus-within:bg-surface-raised focus-within:ring-2 focus-within:ring-focus/25",
        )}
      >
        {prefix ? (
          <span className="text-body text-ink-faint" aria-hidden="true">
            {prefix}
          </span>
        ) : null}
        <input
          id={inputId}
          type={type}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          name={name}
          autoComplete={autoComplete}
          inputMode={numeric ? "decimal" : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "w-full bg-transparent text-body text-ink placeholder:text-ink-faint focus:outline-none",
            numeric && "text-right tabular-nums",
            disabled && "opacity-60",
          )}
        />
        {suffix ? (
          <span className="text-body text-ink-faint" aria-hidden="true">
            {suffix}
          </span>
        ) : null}
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