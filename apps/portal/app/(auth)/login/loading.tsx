export default function LoginLoading() {
  return (
    <main
      className="relative w-full flex-1 flex flex-col items-center justify-center px-4 overflow-hidden bg-transparent"
      aria-busy="true"
      aria-label="Loading sign in page"
    >
      <div className="relative w-full max-w-md z-10">
        <div
          data-testid="login-card-skeleton"
          className="w-full bg-arch-surface-secondary/80 backdrop-blur-xl border border-arch-border-subtle rounded-card p-8 md:p-10 shadow-window"
        >
          {/* Branding Skeleton */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-arch-accent-blue/10 border border-arch-accent-blue/20 flex items-center justify-center mb-3 shadow-diffusion-sm animate-pulse">
              <div className="w-6 h-6 rounded-md bg-arch-accent-blue/30" />
            </div>
            <div className="flex flex-col items-center gap-1.5 w-full">
              <div className="h-6 w-32 bg-neutral-200/80 rounded animate-pulse" />
              <div className="h-3 w-24 bg-neutral-200/60 rounded animate-pulse" />
            </div>
          </div>

          {/* Header Skeleton */}
          <div className="mb-6 space-y-2">
            <div className="h-3 w-20 bg-[var(--accent-blue)]/20 rounded animate-pulse" />
            <div className="h-5 w-48 bg-neutral-200/80 rounded animate-pulse" />
            <div className="h-3.5 w-64 bg-neutral-200/60 rounded animate-pulse" />
          </div>

          {/* Form Skeleton */}
          <div className="space-y-5" aria-hidden="true">
            {/* Email field */}
            <div className="space-y-1.5">
              <div className="h-3 w-24 bg-neutral-200/70 rounded animate-pulse" />
              <div className="h-11 w-full bg-white/70 border border-neutral-200/90 rounded-lg animate-pulse" />
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <div className="h-3 w-20 bg-neutral-200/70 rounded animate-pulse" />
                <div className="h-3 w-24 bg-[var(--accent-blue)]/20 rounded animate-pulse" />
              </div>
              <div className="h-11 w-full bg-white/70 border border-neutral-200/90 rounded-lg animate-pulse" />
            </div>

            {/* Submit button */}
            <div className="h-11 w-full bg-[var(--accent-blue)]/40 rounded-button animate-pulse shadow-card" />
          </div>
        </div>

        {/* Footer Skeleton */}
        <footer className="mt-8 text-center space-y-2 select-none" aria-hidden="true">
          <div className="flex items-center justify-center gap-1.5">
            <div className="w-3.5 h-3.5 bg-accent-green/30 rounded-full animate-pulse" />
            <div className="h-3 w-56 bg-neutral-200/60 rounded animate-pulse" />
          </div>
          <div className="flex justify-center gap-6">
            <div className="h-4 w-24 bg-neutral-200/50 rounded animate-pulse" />
            <div className="h-4 w-16 bg-neutral-200/50 rounded animate-pulse" />
          </div>
        </footer>
      </div>
    </main>
  );
}
