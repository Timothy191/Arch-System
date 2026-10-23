export default function AccessControlLoading() {
  return (
    <div className="space-y-4 p-6" aria-busy="true" aria-label="Loading access control">
      <div className="h-8 w-56 animate-pulse rounded bg-[var(--bg-secondary)]" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl bg-[var(--bg-secondary)]"
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
