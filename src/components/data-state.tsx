type LoadingStateProps = {
  label?: string;
};

type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

type EmptyStateProps = {
  title: string;
  description: string;
};

export function LoadingState({ label = "Loading data..." }: LoadingStateProps) {
  return (
    <div
      className="rounded-lg border border-border-color bg-surface p-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-lg border border-border-color bg-surface p-4" role="alert">
      <p className="text-sm text-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm"
        aria-label="Retry loading data"
      >
        Retry
      </button>
    </div>
  );
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-border-color bg-surface p-4">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  );
}
