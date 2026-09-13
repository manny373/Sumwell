import type { ReactNode } from "react";
import { Card } from "~/components/Card";
import {
  CardIcon,
  ChevronRightIcon,
  LockIcon,
  QuestionIcon,
  SearchIcon,
  SlidersIcon,
} from "~/components/icons";

/** The five sections reachable from the More tab. */
export type MoreSectionId =
  | "credit"
  | "discover"
  | "support"
  | "privacy"
  | "settings";

const SECTIONS: Array<{
  id: MoreSectionId;
  title: string;
  blurb: string;
  icon: (props: { className?: string }) => ReactNode;
}> = [
  {
    id: "credit",
    title: "Credit",
    blurb: "No provider is connected — an honest look at what that means.",
    icon: CardIcon,
  },
  {
    id: "discover",
    title: "Discover",
    blurb: "Labeled synthetic sample offers only — no real products, no approval guesses.",
    icon: SearchIcon,
  },
  {
    id: "support",
    title: "Support",
    blurb: "How the prototype works and what it can't do. Not real support.",
    icon: QuestionIcon,
  },
  {
    id: "privacy",
    title: "Privacy",
    blurb: "Where your data lives and what never leaves this device.",
    icon: LockIcon,
  },
  {
    id: "settings",
    title: "Settings",
    blurb: "Assumptions, theme, export, and start over.",
    icon: SlidersIcon,
  },
];

/**
 * The rest of the More tab — an index into the five honest section screens.
 * Every entry keeps the "not real / prototype" framing visible.
 */
export function MoreSections({ onOpen }: { onOpen(id: MoreSectionId): void }) {
  return (
    <nav aria-label="More sections" className="flex flex-col gap-3">
      <p className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-faint">
        More
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Card key={s.id} interactive padded={false} className="overflow-hidden">
            <button
              type="button"
              onClick={() => onOpen(s.id)}
              className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
            >
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-800 dark:bg-brand-100/40 dark:text-brand-900"
              >
                <s.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body font-semibold text-ink">{s.title}</span>
                <span className="mt-0.5 block text-body-sm leading-snug text-ink-muted">
                  {s.blurb}
                </span>
              </span>
              <ChevronRightIcon
                className="h-5 w-5 shrink-0 text-ink-faint"
                aria-hidden="true"
              />
            </button>
          </Card>
        ))}
      </div>
    </nav>
  );
}