import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "~/lib/cn";
import { XIcon } from "~/components/icons";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Tracks whether this component has mounted in the browser (always false on
 * the server). Gate portal rendering AND dialog behavior on it.
 */
function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/**
 * Shared dialog behavior: focus trap, Esc to close, body scroll lock, and
 * focus restoration to the element that opened the dialog.
 *
 * `open` must already be ANDed with the mounted gate by the caller: the
 * behavior effect binding happens one commit after the caller sets `open`, so
 * if it ran the same commit the panel mounts we'd find an empty panel and
 * focus would land on <body>. Gating on `open && mounted` guarantees the panel
 * is in the DOM before the effect captures focusables.
 */
function useDialogBehavior(
  open: boolean,
  onClose: () => void,
  panelRef: React.RefObject<HTMLDivElement | null>,
) {
  // Keep the latest handler in a ref so the trap can re-bind without tearing
  // down focus on every parent render (inline callbacks change per render).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return; // defensive — see gating contract above

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));

    // Move focus inside the dialog (panel itself is focusable as fallback).
    const first = focusables()[0];
    if (first) first.focus();
    else panel.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus();
    };
  }, [open, panelRef]);
}

function useTitleId(): string {
  return `sw-dialog-${useId().replace(/[^\w-]/g, "")}`;
}

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/**
 * Centered modal dialog with focus trap, Esc close, and backdrop click close.
 * Renders into <body> via a portal but only after the mounted gate flips, so
 * SSR/hydration never touches `document` and the focus trap always finds the
 * committed panel.
 */
export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  const titleId = useTitleId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const mounted = useMounted();
  useDialogBehavior(open && mounted, onClose, panelRef);
  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto p-4">
      <div
        className="fixed inset-0 animate-fade-in bg-scrim"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative grid min-h-full place-items-center py-8">
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={cn(
            "w-full max-w-md animate-scale-in rounded-card border border-line bg-overlay shadow-pop outline-none",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line-faint px-5 py-4">
            <h2 id={titleId} className="text-h3 text-ink">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-control text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              <XIcon className="h-4.5 w-4.5" />
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
          {footer ? (
            <div className="flex flex-wrap justify-end gap-3 border-t border-line-faint px-5 py-4">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export type SheetProps = ModalProps;

/** Bottom sheet (mobile-first) with grip, focus trap, Esc/backdrop close. */
export function Sheet({ open, onClose, title, children, footer, className }: SheetProps) {
  const titleId = useTitleId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const mounted = useMounted();
  useDialogBehavior(open && mounted, onClose, panelRef);
  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 animate-fade-in bg-scrim"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] w-full max-w-lg animate-rise-in flex-col rounded-t-sheet border border-b-0 border-line bg-overlay shadow-pop outline-none",
          className,
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4 px-5 pb-1 pt-2">
          <h2 id={titleId} className="text-h3 text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sheet"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-control text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <XIcon className="h-4.5 w-4.5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-3 border-t border-line-faint px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}