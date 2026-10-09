export default function LoginLoading() {
  return (
    <main
      className="relative w-full flex-1 flex flex-col items-center justify-center px-4 overflow-hidden bg-transparent bg-[radial-gradient(circle_at_2px_2px,rgba(0,0,0,0.03)_1px,transparent_0)] bg-[size:32px_32px]"
      aria-busy="true"
      aria-label="Loading sign in page"
    >
      {/* Ambient Gold Accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute w-[600px] h-[600px] rounded-full blur-[50px] -top-48 -left-48 -z-10 bg-[radial-gradient(circle,rgba(217,119,6,0.07)_0%,rgba(243,244,246,0)_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute w-[600px] h-[600px] rounded-full blur-[50px] -bottom-48 -right-48 -z-10 bg-[radial-gradient(circle,rgba(217,119,6,0.07)_0%,rgba(243,244,246,0)_70%)]"
      />

      <div className="relative w-full max-w-md z-10">
        <div
          data-testid="login-card-skeleton"
          className="w-full bg-white/80 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-8 md:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.04)]"
        >
          {/* Branding Skeleton */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#c59837]/30 via-[#a36c1e]/30 to-[#71440d]/30 border border-amber-400/30 flex items-center justify-center mb-3 shadow-md shadow-amber-900/10 animate-pulse">
              <div className="w-6 h-6 rounded-md bg-amber-400/40" />
            </div>
            <div className="flex flex-col items-center gap-1.5 w-full">
              <div className="h-6 w-32 bg-neutral-200/80 rounded animate-pulse" />
              <div className="h-3 w-24 bg-neutral-200/60 rounded animate-pulse" />
            </div>
          </div>

          {/* Header Skeleton */}
          <div className="mb-6 space-y-2">
            <div className="h-3 w-20 bg-amber-200/70 rounded animate-pulse" />
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
                <div className="h-3 w-24 bg-amber-200/70 rounded animate-pulse" />
              </div>
              <div className="h-11 w-full bg-white/70 border border-neutral-200/90 rounded-lg animate-pulse" />
            </div>

            {/* Submit button */}
            <div className="h-11 w-full bg-gradient-to-b from-[#c59837]/60 via-[#a36c1e]/60 to-[#71440d]/60 rounded-lg border border-amber-400/30 animate-pulse shadow-md" />
          </div>
        </div>

        {/* Footer Skeleton */}
        <footer className="mt-8 text-center space-y-2 select-none" aria-hidden="true">
          <div className="flex items-center justify-center gap-1.5">
            <div className="w-3.5 h-3.5 bg-amber-200/70 rounded-full animate-pulse" />
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
