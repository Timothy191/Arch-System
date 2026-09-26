export default function DrillingLoading() {
  return (
    <div className="space-y-4 p-6" aria-busy="true" aria-label="Loading drilling operations">
      <div className="h-8 w-48 bg-[var(--bg-secondary)] rounded animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 bg-[var(--bg-secondary)] rounded-xl animate-pulse"
            aria-hidden="true"
          />
        ))}
      </div>
      <div className="h-64 bg-[var(--bg-secondary)] rounded-xl animate-pulse" aria-hidden="true" />
    </div>
  );
}
