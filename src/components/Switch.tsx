import { cn } from "~/lib/cn";

export type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Label text shown beside the control (button is implicitly labelled). */
  label: string;
  disabled?: boolean;
  className?: string;
};

/** Accessible toggle: role="switch", Space/Enter via native button. */
export function Switch({ checked, onChange, label, disabled, className }: SwitchProps) {
  return (
    <label
      className={cn(
        "flex items-center gap-3 select-none",
        disabled ? "opacity-50" : "cursor-pointer",
        className,
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-pill transition-colors duration-150",
          checked ? "bg-brand-600" : "bg-line-strong",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-150",
            checked && "translate-x-5",
          )}
        />
      </button>
      <span className="text-body text-ink">{label}</span>
    </label>
  );
}