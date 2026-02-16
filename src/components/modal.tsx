import { useEffect, useRef, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handler = () => onClose();
    dialog.addEventListener("close", handler);
    return () => dialog.removeEventListener("close", handler);
  }, [onClose]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-lg rounded-lg border border-border-color bg-surface p-0 text-foreground backdrop:bg-black/50"
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
    >
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
};

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "Confirm", loading = false }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="mb-4 text-sm text-muted">{message}</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
        <button type="button" onClick={onConfirm} disabled={loading} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">
          {loading ? "Processing..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
