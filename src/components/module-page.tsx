import { useId, type ReactNode } from "react";
import { useLanguage } from "@/lib/i18n";

type ModulePageProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function ModulePage({ title, description, children }: ModulePageProps) {
  const { translate } = useLanguage();
  const hasCustomContent = Boolean(children);
  const headingId = useId();
  const descriptionId = useId();

  return (
    <section className="space-y-4" aria-labelledby={headingId} aria-describedby={descriptionId}>
      <header>
        <h2 id={headingId} className="text-2xl font-semibold">
          {translate(title)}
        </h2>
        <p id={descriptionId} className="text-sm text-muted">
          {translate(description)}
        </p>
      </header>

      {!hasCustomContent && (
        <div className="rounded-lg border border-border-color bg-surface p-4">
          <p className="text-sm text-muted">
            {translate("Phase 1 skeleton ready for implementation.")}
          </p>
        </div>
      )}

      {children}
    </section>
  );
}

