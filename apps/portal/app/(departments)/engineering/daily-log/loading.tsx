export default function EngineeringDailyLogLoading() {
  return (
    <div className="space-y-4 p-6" aria-busy="true" aria-label="Loading engineering daily log">
      <div className="h-8 w-64 animate-pulse rounded bg-[var(--bg-secondary)]" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-xl bg-[var(--bg-secondary)]"
            aria-hidden="true"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-[var(--bg-secondary)]" aria-hidden="true" />
    </div>
  );
}
