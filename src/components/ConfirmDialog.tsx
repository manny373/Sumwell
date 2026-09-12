import type { ReactNode } from "react";
import { Button } from "~/components/Button";
import { Modal } from "~/components/Dialog";

export type ConfirmTone = "danger" | "primary";

export type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** "danger" (destructive, default) or "primary" (brand) confirm button. */
  tone?: ConfirmTone;
  /** Disables the confirm button and shows a spinner (async confirm). */
  loading?: boolean;
};

export function ConfirmDialog({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  tone = "danger",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "destructive" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-body text-ink-muted">{body}</div>
    </Modal>
  );
}