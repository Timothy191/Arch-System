import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";
import withBundleAnalyzer from "@next/bundle-analyzer";

const require = createRequire(import.meta.url);
const { version: PORTAL_VERSION } = require("./package.json");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "../..");

const isProduction = process.env.NODE_ENV === "production";
const isCI = process.env.CI === "true";
// next build always sets NODE_ENV=production, so we use CI to distinguish local builds
const enableHeavyPlugins = isCI || process.env.ENABLE_HEAVY_PLUGINS === "true";

const DEPARTMENT_SLUG_PATTERN =
  "drilling|production|access-control|engineering|control-room|safety|training|satellite-monitoring|access-card-actions";

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // AGENT-TRACE: Root must include workspaceRoot to allow dependencies from packages/ to be compiled
    root: workspaceRoot,
  },
  output: enableHeavyPlugins ? "standalone" : undefined,
  env: {
    PORTAL_VERSION,
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
  ],
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
  },
  compiler: {
    removeConsole: isProduction && {
      exclude: ["error", "warn", "info"],
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
    optimizePackageImports: ["lucide-react", "framer-motion", "@tremor/react"],
    inlineCss: true,
    webVitalsAttribution: ["CLS", "LCP", "FCP", "TTFB", "INP"],
  },
  async rewrites() {
    return [
      {
        source: `/hub/:dept(${DEPARTMENT_SLUG_PATTERN})/:path*`,
        destination: "/:dept/:path*",
      },
      {
        source: `/hub/:dept(${DEPARTMENT_SLUG_PATTERN})`,
        destination: "/:dept",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: `/:dept(${DEPARTMENT_SLUG_PATTERN})/:path*`,
        destination: "/hub/:dept/:path*",
        permanent: false,
      },
      {
        source: `/:dept(${DEPARTMENT_SLUG_PATTERN})`,
        destination: "/hub/:dept",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
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
            value: "camera=(), microphone=(), geolocation=()",
          },
          ...(isProduction
            ? [
                {
                  key: "Content-Security-Policy",
                  value:
                    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in wss://*.supabase.in; frame-src 'self' http://localhost:* https://*.ngrok-free.app; frame-ancestors 'none';",
                },
              ]
            : [
                {
                  key: "Content-Security-Policy-Report-Only",
                  value:
                    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in wss://*.supabase.in; frame-src 'self' http://localhost:* https://*.ngrok-free.app; frame-ancestors 'none'; report-uri /api/csp-violations;",
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
      tunnelRoute: "/monitoring",
      hideSourceMaps: true,
    })
  : analyzedConfig;
