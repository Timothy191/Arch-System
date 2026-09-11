import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

const require = createRequire(import.meta.url);
const { version: PORTAL_VERSION } = require("./package.json");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Root includes both Arch-System and Arch-Base so Turbopack allows cross-repo symlinked packages
const workspaceRoot = path.resolve(__dirname, "../../..");

const isProduction = process.env.NODE_ENV === "production";
const isCI = process.env.CI === "true";
// next build always sets NODE_ENV=production, so we use CI to distinguish local builds
const enableHeavyPlugins = isCI || process.env.ENABLE_HEAVY_PLUGINS === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // AGENT-TRACE: Turbopack is used for both dev (`next dev --turbopack`) and production builds
  // (`next build`). Webpack (`next build --webpack`) produces better chunk deduplication (0 vs
  // 3×576 KB duplicates), but fails because `inngest` uses `node:async_hooks` which Webpack 5
  // can't handle. Until Turbopack improves deduplication or inngest is excluded from the client
  // bundle, we accept the 67 KB overhead. Track: Turbopack chunk deduplication improvements.
  turbopack: {
    root: workspaceRoot,
  },
  output: "standalone",
  env: {
    PORTAL_VERSION,
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/hub",
        permanent: false,
      },
    ];
  },
  // AGENT-TRACE: Aria assistant is served by a standalone sidecar (aria-overlay,
  // basePath `/assistant`). The portal proxies it server-side so the iframe stays
  // same-origin and Supabase cookies flow; AI_ASSISTANT_URL points at the sidecar.
  async rewrites() {
    const assistantUrl = process.env.AI_ASSISTANT_URL ?? "http://127.0.0.1:3100";
    return [
      {
        source: "/assistant/:path*",
        destination: `${assistantUrl}/assistant/:path*`,
      },
    ];
  },
  typescript: {
    // !! DANGER !!
    // Only allow skipping type checks in local development!
    // Never skip type checking in CI.
    ignoreBuildErrors: process.env.SKIP_TYPE_CHECK === "true" && process.env.CI !== "true",
  },
  transpilePackages: [
    "@repo/ui",
    "@repo/supabase",
    "@repo/utils",
    "@repo/redis",
    "@repo/theme",
    "@repo/rate-limiter",
    "@repo/logger",
    "@repo/contract",
    "@repo/auth/ui",
    "@repo/auth/data-access",
    "@repo/auth/utils",
    "@repo/shared/data-access",
    "@repo/shared/utils",
    "@repo/shared/hooks",
    "@repo/departments/ui",
    "@repo/hub/ui",
    "@repo/dashboard/data-access",
    // AGENT-TRACE: @liqui-design/glass ships glass.css with @layer base which
    // requires @tailwind base to be present in the same PostCSS pass.
    // transpiling it ensures Turbopack runs it through our full PostCSS pipeline.
    "@liqui-design/glass",
  ],
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
      { protocol: "https", hostname: "avatar.vercel.sh" },
    ],
  },
  compiler: {
    // AGENT-TRACE: In production, strip console.warn and console.info to reduce bundle size
    // and prevent sensitive data leakage. Keep console.error for Sentry error capture.
    removeConsole: isProduction && {
      exclude: ["error"],
    },
  },
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.performance = {
        hints: "warning",
        maxAssetSize: 512000, // 500 KB
        maxEntrypointSize: 1024000, // 1 MB
        assetFilter: (assetFilename) =>
          assetFilename.endsWith(".js") || assetFilename.endsWith(".css"),
      };
    }
    return config;
  },
  experimental: {
    // AGENT-TRACE: optimizePackageImports tree-shakes large icon, UI, and animation modules at compile time
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@tremor/react",
      "@xyflow/react",
      "clsx",
      "tailwind-merge",
      "date-fns",
      "recharts",
      "sonner",
      "@ai-sdk/react",
      "@radix-ui/react-tabs",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-popover",
    ],
    // AGENT-TRACE: Inlines critical CSS chunks directly into SSR output to eliminate render-blocking CSS roundtrips
    inlineCss: false,
    // AGENT-TRACE: Injects detailed attribution info (elements, network events) into useReportWebVitals
    webVitalsAttribution: ["CLS", "LCP", "FCP", "TTFB", "INP"],
    // AGENT-TRACE: Next.js 16 Cache Components custom cacheLife profiles
    cacheLife: {
      telemetry: {
        stale: 5,
        revalidate: 10,
        expire: 30,
      },
      departments: {
        stale: 300,
        revalidate: 3600,
        expire: 86400,
      },
      reports: {
        stale: 60,
        revalidate: 300,
        expire: 1800,
      },
    },
  },
  async headers() {
    return [
      // AGENT-TRACE: Aria's proxied document is embedded in a same-origin iframe,
      // so its header rule must allow framing (SAMEORIGIN + frame-ancestors 'self')
      // and must NOT be overridden by the DENY/'none' generic rule below. The
      // generic rule therefore excludes the /assistant prefix.
      {
        source: "/assistant/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          ...(isProduction
            ? [
                {
                  key: "Content-Security-Policy",
                  value:
                    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'self';",
                },
              ]
            : [
                {
                  key: "Content-Security-Policy-Report-Only",
                  value:
                    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*; object-src 'none'; frame-ancestors 'self'; report-uri /api/csp-violations;",
                },
              ]),
        ],
      },
      {
        source: "/((?!assistant(?:/|$)).*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), clipboard-write=(self), clipboard-read=(self)",
          },
          ...(isProduction
            ? [
                {
                  key: "Content-Security-Policy",
                  value:
                    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://avatar.vercel.sh https://*.whatsapp.net https://*.whatsapp.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in wss://*.supabase.in https://us.cloud.langfuse.com https://*.r2.cloudflarestorage.com https://api.open-meteo.com wss://*.web.whatsapp.com https://*.whatsapp.com; frame-src 'self' http://localhost:* https://*.ngrok-free.app https://*.whatsapp.com https://web.whatsapp.com; frame-ancestors 'none';",
                },
              ]
            : [
                {
                  key: "Content-Security-Policy-Report-Only",
                  value:
                    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://avatar.vercel.sh https://*.whatsapp.net https://*.whatsapp.com; connect-src 'self' http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:* https://*.supabase.co wss://*.supabase.co https://*.supabase.in wss://*.supabase.in https://us.cloud.langfuse.com https://*.r2.cloudflarestorage.com https://api.open-meteo.com wss://*.web.whatsapp.com https://*.whatsapp.com; frame-src 'self' http://localhost:* https://*.ngrok-free.app https://*.whatsapp.com https://web.whatsapp.com; frame-ancestors 'none'; report-uri /api/csp-violations;",
                },
              ]),
        ],
      },
      // GAP-5: cache directives so upstream CDNs can absorb static and health
      // traffic. Per-user and per-session routes explicitly opt out.
      ...(isProduction
        ? [
            {
              source: "/_next/static/:path*",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=31536000, immutable",
                },
              ],
            },
            {
              source: "/manifest.webmanifest",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=3600, stale-while-revalidate=86400",
                },
              ],
            },
            {
              source: "/sw.js",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=0, must-revalidate",
                },
              ],
            },
            {
              source: "/workbox-:hash.js",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=0, must-revalidate",
                },
              ],
            },
            {
              source: "/login",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=0, stale-while-revalidate=86400",
                },
              ],
            },
            {
              source: "/api/health",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=60, stale-while-revalidate=600",
                },
              ],
            },
            {
              source: "/api/auth/:path*",
              headers: [{ key: "Cache-Control", value: "private, no-store" }],
            },
            {
              source: "/api/ai/:path*",
              headers: [{ key: "Cache-Control", value: "private, no-store" }],
            },
            {
              source: "/error-pages/:path*",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=31536000, immutable",
                },
              ],
            },
          ]
        : []),
    ];
  },
};

// AGENT-TRACE: PWA configuration disabled in favor of manual service worker
// Next.js 16 + Turbopack doesn't support PWA plugins (next-pwa/Serwist)
// Manual service worker at public/sw.js handles caching instead
// Keeping PWA plugin disabled but available for future migration
const pwaConfig = nextConfig;

const analyzedConfig = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})(pwaConfig);

// Skip Sentry source-map upload in local builds — saves ~10-15s per clean build
export default enableHeavyPlugins
  ? withSentryConfig(analyzedConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !isCI,
      dryRun: !isCI,
      widenClientFileUpload: isCI,
      tunnelRoute: "/api/sentry-proxy",
      hideSourceMaps: true,
    })
  : analyzedConfig;
