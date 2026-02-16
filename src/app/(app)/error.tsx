"use client";

import { useEffect } from "react";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="space-y-4" role="alert">
      <header>
        <h2 className="text-2xl font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted">
          A module error occurred while loading this section.
        </p>
      </header>
      <div className="rounded-lg border border-border-color bg-surface p-4">
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm"
        >
          Try again
        </button>
      </div>
    </section>
  );
}
