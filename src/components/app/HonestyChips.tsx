/**
 * The honesty chips the founder wants visible on the onboarding first screen —
 * reused wherever the prototype's nature must not be missed.
 */
const CHIPS = ["Synthetic demo data", "No bank connections", "Prototype"];

export function HonestyChips({ className }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center justify-center gap-2 ${className ?? ""}`}>
      {CHIPS.map((chip) => (
        <li
          key={chip}
          className="rounded-pill border border-line bg-surface-raised px-3 py-1 text-caption font-medium text-ink-muted"
        >
          {chip}
        </li>
      ))}
    </ul>
  );
}