export default function WorkLoading() {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl" aria-busy="true" aria-live="polite">
        <p className="eyebrow">Committee operations</p>
        <h1 className="page-title">Work</h1>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="surface h-48 animate-pulse bg-white/70" />
          ))}
        </div>
        <p className="sr-only">Loading committee tasks.</p>
      </div>
    </main>
  );
}
