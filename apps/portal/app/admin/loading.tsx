export default function AdminLoading() {
  return (
    <div className="space-y-4 p-6" aria-busy="true" aria-label="Loading admin panel">
      <div className="h-8 w-32 bg-[var(--bg-secondary)] rounded animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 bg-[var(--bg-secondary)] rounded-xl animate-pulse"
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
