export default function LoginLoading() {
  return (
    <main
      className="relative flex w-full flex-1 flex-col items-center justify-center overflow-hidden bg-transparent px-4"
      aria-busy="true"
      aria-label="Loading sign in page"
    >
      <div className="relative z-10 w-full max-w-md">
        <div
          data-testid="login-card-skeleton"
          className="w-full rounded-card border border-arch-border-subtle bg-arch-surface-secondary/80 p-8 shadow-window backdrop-blur-xl md:p-10"
        >
          {/* Branding Skeleton */}
          <div className="mb-6 flex flex-col items-center">
            <div className="mb-3 flex h-12 w-12 animate-pulse items-center justify-center rounded-xl border border-arch-accent-blue/20 bg-arch-accent-blue/10 shadow-diffusion-sm">
              <div className="h-6 w-6 rounded-md bg-arch-accent-blue/30" />
            </div>
            <div className="flex w-full flex-col items-center gap-1.5">
              <div className="h-6 w-32 animate-pulse rounded bg-neutral-200/80" />
              <div className="h-3 w-24 animate-pulse rounded bg-neutral-200/60" />
            </div>
          </div>

          {/* Header Skeleton */}
          <div className="mb-6 space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-[var(--accent-blue)]/20" />
            <div className="h-5 w-48 animate-pulse rounded bg-neutral-200/80" />
            <div className="h-3.5 w-64 animate-pulse rounded bg-neutral-200/60" />
          </div>

          {/* Form Skeleton */}
          <div className="space-y-5" aria-hidden="true">
            {/* Email field */}
            <div className="space-y-1.5">
              <div className="h-3 w-24 animate-pulse rounded bg-neutral-200/70" />
              <div className="h-11 w-full animate-pulse rounded-lg border border-neutral-200/90 bg-white/70" />
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="h-3 w-20 animate-pulse rounded bg-neutral-200/70" />
                <div className="h-3 w-24 animate-pulse rounded bg-[var(--accent-blue)]/20" />
              </div>
              <div className="h-11 w-full animate-pulse rounded-lg border border-neutral-200/90 bg-white/70" />
            </div>

            {/* Submit button */}
            <div className="h-11 w-full animate-pulse rounded-button bg-[var(--accent-blue)]/40 shadow-card" />
          </div>
        </div>

        {/* Footer Skeleton */}
        <footer className="mt-8 select-none space-y-2 text-center" aria-hidden="true">
          <div className="flex items-center justify-center gap-1.5">
            <div className="h-3.5 w-3.5 animate-pulse rounded-full bg-accent-green/30" />
            <div className="h-3 w-56 animate-pulse rounded bg-neutral-200/60" />
          </div>
          <div className="flex justify-center gap-6">
            <div className="h-4 w-24 animate-pulse rounded bg-neutral-200/50" />
            <div className="h-4 w-16 animate-pulse rounded bg-neutral-200/50" />
          </div>
        </footer>
      </div>
    </main>
  );
}
