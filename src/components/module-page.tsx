import { useId, type ReactNode } from "react";

type ModulePageProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function ModulePage({ title, description, children }: ModulePageProps) {
  const hasCustomContent = Boolean(children);
  const headingId = useId();
  const descriptionId = useId();

  return (
    <section className="space-y-4" aria-labelledby={headingId} aria-describedby={descriptionId}>
      <header>
        <h2 id={headingId} className="text-2xl font-semibold">
          {title}
        </h2>
        <p id={descriptionId} className="text-sm text-muted">
          {description}
        </p>
      </header>

      {!hasCustomContent && (
        <div className="rounded-lg border border-border-color bg-surface p-4">
          <p className="text-sm text-muted">Phase 1 skeleton ready for implementation.</p>
        </div>
      )}

      {children}
    </section>
  );
}
