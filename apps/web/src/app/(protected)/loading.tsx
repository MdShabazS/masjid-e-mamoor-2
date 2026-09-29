export default function ProtectedLoading() {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8" aria-busy="true" aria-label="Loading">
      <div className="mx-auto max-w-7xl animate-pulse space-y-6">
        <div className="h-4 w-32 rounded bg-emerald-900/10" />
        <div className="h-10 w-72 rounded bg-emerald-900/10" />
        <div className="h-4 max-w-lg rounded bg-emerald-900/10" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="h-32 rounded-xl bg-white/70" />
          <div className="h-32 rounded-xl bg-white/70" />
          <div className="h-32 rounded-xl bg-white/70" />
        </div>
      </div>
    </main>
  );
}
