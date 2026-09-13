import type { ReactNode } from "react";
import { Button } from "~/components/Button";
import { ArrowLeftIcon } from "~/components/icons";

/**
 * Shared scaffold for the More section screens: a back button, a heading, an
 * honest subtitle, and the section body.
 */
export function SectionScaffold({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2.5">
        <Button variant="ghost" size="sm" onClick={onBack} className="w-fit">
          <ArrowLeftIcon className="h-4 w-4" />
          Back to More
        </Button>
        <div>
          <h1 className="text-h1 text-ink">{title}</h1>
          <p className="mt-1 max-w-xl text-body-sm text-ink-muted">{subtitle}</p>
        </div>
      </header>
      {children}
    </div>
  );
}