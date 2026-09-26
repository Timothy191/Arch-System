export default function EngineeringLoading() {
  return (
    <div className="space-y-4 p-6" aria-busy="true" aria-label="Loading engineering">
      <div className="h-8 w-40 bg-[var(--bg-secondary)] rounded animate-pulse" />
      <div className="h-48 bg-[var(--bg-secondary)] rounded-xl animate-pulse" aria-hidden="true" />
      <div className="grid grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-32 bg-[var(--bg-secondary)] rounded-xl animate-pulse"
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
