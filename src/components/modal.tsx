import { useEffect, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function Modal({ open, onClose, title, children }: ModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="pointer-events-auto absolute inset-0 bg-black/50"
        onMouseDown={onClose}
      />
      {/* Panel */}
      <div className="pointer-events-auto relative z-10 mx-4 w-full max-w-lg rounded-lg border border-border-color bg-surface p-6 text-foreground shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
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

type SideDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
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

export function SideDrawer({ open, onClose, title, children }: SideDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Backdrop with blur */}
      <button
        type="button"
        aria-label="Close details"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      {/* Centered Panel - Wider than before */}
      <aside className="relative z-10 flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border-color bg-surface text-foreground shadow-2xl transition-all">
        <header className="flex shrink-0 items-center justify-between border-b border-border-color/50 bg-surface-elevated/50 px-6 py-4">
          <h3 className="text-lg font-bold tracking-tight">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-muted/10 hover:text-foreground"
          >
            <span className="text-2xl leading-none">&times;</span>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
          {children}
        </div>
      </aside>
    </div>
  );
}
