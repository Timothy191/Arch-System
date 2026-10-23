export default function EngineeringLoading() {
  return (
    <div className="space-y-4 p-6" aria-busy="true" aria-label="Loading engineering">
      <div className="h-8 w-40 animate-pulse rounded bg-[var(--bg-secondary)]" />
      <div className="h-48 animate-pulse rounded-xl bg-[var(--bg-secondary)]" aria-hidden="true" />
      <div className="grid grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl bg-[var(--bg-secondary)]"
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
