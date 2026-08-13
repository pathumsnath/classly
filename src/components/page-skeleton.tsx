// Shown instantly on navigation (see loading.tsx in each route folder)
// while the real page's data streams in behind it — matches PageShell's
// header chrome dimensions so the swap-in doesn't jump around, with a
// few pulsing placeholder blocks standing in for whatever list/cards the
// real page will render.
export function PageSkeleton() {
  return (
    <main className="min-h-full flex-1 bg-gray-50">
      <div className="mx-auto flex max-w-2xl animate-pulse flex-col gap-6 pb-10">
        <header className="flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="h-5 w-5 rounded-full bg-gray-100" />
            <span className="h-5 w-32 rounded bg-gray-100" />
          </div>
          <span className="h-5 w-5 rounded bg-gray-100" />
        </header>
        <div className="flex flex-col gap-3 px-4 sm:px-6">
          <div className="h-20 rounded-xl border border-gray-100 bg-white" />
          <div className="h-16 rounded-xl border border-gray-100 bg-white" />
          <div className="h-16 rounded-xl border border-gray-100 bg-white" />
          <div className="h-16 rounded-xl border border-gray-100 bg-white" />
        </div>
      </div>
    </main>
  );
}

// The dashboard builds its own header (institute name + role, no back
// arrow) instead of using PageShell, so it gets a matching skeleton.
export function DashboardSkeleton() {
  return (
    <main className="min-h-full flex-1 bg-gray-50">
      <div className="mx-auto flex max-w-2xl animate-pulse flex-col gap-6 pb-10">
        <header className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-2">
            <span className="h-5 w-40 rounded bg-gray-100" />
            <span className="h-3.5 w-24 rounded bg-gray-100" />
          </div>
          <span className="h-8 w-8 rounded-full bg-gray-100" />
        </header>
        <div className="grid grid-cols-3 gap-3 px-4 sm:grid-cols-4 sm:px-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-gray-100 bg-white" />
          ))}
        </div>
        <div className="flex flex-col gap-3 px-4 sm:px-6">
          <div className="h-16 rounded-xl border border-gray-100 bg-white" />
          <div className="h-16 rounded-xl border border-gray-100 bg-white" />
        </div>
      </div>
    </main>
  );
}
