export default function AppLoading() {
  return (
    <section className="space-y-4" aria-busy="true" aria-live="polite">
      <header>
        <h2 className="text-2xl font-semibold">Loading...</h2>
        <p className="text-sm text-muted">Preparing dashboard data and modules.</p>
      </header>
      <div className="rounded-lg border border-border-color bg-surface p-4">
        <p className="text-sm text-muted">Please wait while content is loading.</p>
      </div>
    </section>
  );
}
