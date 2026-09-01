export default function AccessControlLoading() {
  return (
    <div className="space-y-4 p-6" aria-busy="true" aria-label="Loading access control">
      <div className="h-8 w-56 bg-[var(--bg-secondary)] rounded animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-40 bg-[var(--bg-secondary)] rounded-xl animate-pulse"
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
