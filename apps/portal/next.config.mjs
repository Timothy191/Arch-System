import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import withBundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';
import { withWorkflow } from 'workflow/next';

const require = createRequire(import.meta.url);
const { version: PORTAL_VERSION } = require('./package.json');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Root includes both Arch-System and Arch-Base so Turbopack allows cross-repo symlinked packages
const workspaceRoot = path.resolve(__dirname, '../..');

const isProduction = process.env.NODE_ENV === 'production';
const isCI = process.env.CI === 'true';
// next build always sets NODE_ENV=production, so we use CI to distinguish local builds
const enableHeavyPlugins = isCI || process.env.ENABLE_HEAVY_PLUGINS === 'true';

// Build-time environment validation (Rule P8 / Quality gates)
if (isProduction && !process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.IGNORE_ENV_VALIDATION) {
  console.warn('⚠️  WARNING: NEXT_PUBLIC_SUPABASE_URL is not set at build time.');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // AGENT-TRACE: Next.js 16 Cache Components enabled for 'use cache' directives and granular component prerendering
  cacheComponents: true,
  // AGENT-TRACE: Turbopack is used for both dev (`next dev --turbopack`) and production builds
  // (`next build`). Webpack (`next build --webpack`) produces better chunk deduplication (0 vs
  // 3×576 KB duplicates), but fails because `inngest` uses `node:async_hooks` which Webpack 5
  // can't handle. Until Turbopack improves deduplication or inngest is excluded from the client
  outputFileTracingRoot: workspaceRoot,
  outputFileTracingExcludes: {
    '*': [
      '**/.agents/**',
      '**/.gemini/**',
      '**/.palabre/**',
      '**/.swarm/**',
      '**/.remember/**',
      '**/.claude/**',
      '**/.cursor/**',
      '**/.omg/**',
      '**/.kiro/**',
      '**/.junie/**',
      '**/.ori/**',
      '**/AGENTS.md',
      '**/CLAUDE.md',
      '**/GEMINI.md',
      '**/.claude.local.md',
      '**/.cursorrules',
      '**/REVIEW.md',
      '**/*AGENT_TRACER.md',
      '**/docs/**',
      '**/documentation/**',
      '**/tests/**',
      '**/e2e/**',
      '**/k6/**',
      '**/playwright-report/**',
      '**/coverage/**',
      '**/tools/**',
      '**/scripts/**',
      '**/.github/**',
      '**/.mcp.json*',
    ],
  },
  turbopack: {
    root: workspaceRoot,
  },
  // AGENT-TRACE: On Vercel, omit standalone output so Next.js uses native Vercel lambda tracing.
  // In Docker/self-hosted environments, produce standalone output.
  output: process.env.VERCEL ? undefined : 'standalone',
  env: {
    PORTAL_VERSION,
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/hub',
        permanent: false,
      },
    ];
  },
  typescript: {
    // !! DANGER !!
    // Only allow skipping type checks in local development!
    // Never skip type checking in CI.
    ignoreBuildErrors: process.env.SKIP_TYPE_CHECK === 'true' && process.env.CI !== 'true',
  },
  transpilePackages: [
    '@repo/ui',
    '@repo/supabase',
    '@repo/utils',
    '@repo/redis',
    '@repo/theme',
    '@repo/rate-limiter',
    '@repo/logger',
    '@repo/contract',
    '@repo/auth/ui',
    '@repo/auth/data-access',
    '@repo/auth/utils',
    '@repo/shared/data-access',
    '@repo/shared/utils',
    '@repo/shared/hooks',
    '@repo/departments/ui',
    '@repo/departments/data-access',
    '@repo/hub/ui',
    // AGENT-TRACE: @liqui-design/glass ships glass.css with @layer base which
    // requires @tailwind base to be present in the same PostCSS pass.
    // transpiling it ensures Turbopack runs it through our full PostCSS pipeline.
    '@liqui-design/glass',
  ],
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      { protocol: 'https', hostname: 'avatar.vercel.sh' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: '*.whatsapp.net' },
      { protocol: 'https', hostname: '*.whatsapp.com' },
    ],
  },
  compiler: {
    // AGENT-TRACE: In production, strip console.warn and console.info to reduce bundle size
    // and prevent sensitive data leakage. Keep console.error for Sentry error capture.
    removeConsole: isProduction && {
      exclude: ['error'],
    },
  },
  reactStrictMode: true,
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.performance = {
        hints: dev ? false : 'warning',
        maxAssetSize: 1024000, // 1 MB
        maxEntrypointSize: 2048000, // 2 MB
        assetFilter: (assetFilename) =>
          !assetFilename.includes('exceljs') &&
          (assetFilename.endsWith('.js') || assetFilename.endsWith('.css')),
      };
    }
    return config;
  },
  // AGENT-TRACE: Next.js 16 Cache Components custom cacheLife profiles (moved out of experimental)
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
  logging: {
    fetches: {
      fullUrl: !isProduction,
    },
    browserToTerminal: 'warn',
  },
  serverExternalPackages: ['@babel/core', '@babel/traverse', 'p-limit'],
  experimental: {
    // AGENT-TRACE: React 19 Taint APIs enabled to prevent sensitive database objects/tokens crossing RSC boundary
    taint: true,
    // AGENT-TRACE: optimizePackageImports tree-shakes large icon, UI, and animation modules at compile time
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@tremor/react',
      '@xyflow/react',
      'clsx',
      'tailwind-merge',
      'date-fns',
      'recharts',
      'sonner',
      '@radix-ui/react-tabs',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-popover',
      '@repo/ui',
    ],
    // AGENT-TRACE: Inlines critical CSS chunks directly into SSR output to eliminate render-blocking CSS roundtrips
    inlineCss: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), clipboard-write=(self), clipboard-read=(self)',
          },
          ...(isProduction
            ? [
                {
                  key: 'Content-Security-Policy',
                  value:
                    "default-src 'self'; script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://avatar.vercel.sh https://*.whatsapp.net https://*.whatsapp.com https://res.cloudinary.com; media-src 'self' data: blob: https://res.cloudinary.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in wss://*.supabase.in https://us.cloud.langfuse.com https://*.r2.cloudflarestorage.com https://api.open-meteo.com wss://*.web.whatsapp.com https://*.whatsapp.com https://arch-system-nest-proxy.vercel.app wss://arch-system-nest-proxy.vercel.app https://plantcor-redis-serverless.vercel.app https://n8n-vercel-alpha.vercel.app https://va.vercel-scripts.com; frame-src 'self' http://localhost:* https://*.ngrok-free.app https://*.whatsapp.com https://web.whatsapp.com https://arch-system-nest-proxy.vercel.app https://n8n-vercel-alpha.vercel.app; frame-ancestors 'none';",
                },
              ]
            : [
                {
                  key: 'Content-Security-Policy-Report-Only',
                  value:
                    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://avatar.vercel.sh https://*.whatsapp.net https://*.whatsapp.com https://res.cloudinary.com; media-src 'self' data: blob: https://res.cloudinary.com; connect-src 'self' http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:* https://*.supabase.co wss://*.supabase.co https://*.supabase.in wss://*.supabase.in https://us.cloud.langfuse.com https://*.r2.cloudflarestorage.com https://api.open-meteo.com wss://*.web.whatsapp.com https://*.whatsapp.com https://arch-system-nest-proxy.vercel.app wss://arch-system-nest-proxy.vercel.app https://plantcor-redis-serverless.vercel.app https://n8n-vercel-alpha.vercel.app https://va.vercel-scripts.com; frame-src 'self' http://localhost:* https://*.ngrok-free.app https://*.whatsapp.com https://web.whatsapp.com https://arch-system-nest-proxy.vercel.app https://n8n-vercel-alpha.vercel.app; frame-ancestors 'none'; report-uri /api/csp-violations;",
                },
              ]),
        ],
      },
      // GAP-5: cache directives so upstream CDNs can absorb static and health
      // traffic. Per-user and per-session routes explicitly opt out.
      ...(isProduction
        ? [
            {
              source: '/manifest.webmanifest',
              headers: [
                {
                  key: 'Cache-Control',
                  value: 'public, max-age=3600, stale-while-revalidate=86400',
                },
              ],
            },
            {
              source: '/sw.js',
              headers: [
                {
                  key: 'Cache-Control',
                  value: 'public, max-age=0, must-revalidate',
                },
              ],
            },
            {
              source: '/workbox-:hash.js',
              headers: [
                {
                  key: 'Cache-Control',
                  value: 'public, max-age=0, must-revalidate',
                },
              ],
            },
            {
              source: '/login',
              headers: [
                {
                  key: 'Cache-Control',
                  value: 'public, max-age=0, stale-while-revalidate=86400',
                },
              ],
            },
            {
              source: '/api/health',
              headers: [
                {
                  key: 'Cache-Control',
                  value: 'public, max-age=60, stale-while-revalidate=600',
                },
              ],
            },
            {
              source: '/api/auth/:path*',
              headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
            },
            {
              source: '/api/ai/:path*',
              headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
            },
            {
              source: '/error-pages/:path*',
              headers: [
                {
                  key: 'Cache-Control',
                  value: 'public, max-age=31536000, immutable',
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
  enabled: process.env.ANALYZE === 'true',
})(pwaConfig);

const workflowConfig = withWorkflow(analyzedConfig);

// Skip Sentry source-map upload in local builds — saves ~10-15s per clean build
export default enableHeavyPlugins
  ? withSentryConfig(workflowConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !isCI,
      dryRun: !isCI,
      widenClientFileUpload: isCI,
      tunnelRoute: '/api/sentry-proxy',
      hideSourceMaps: true,
    })
  : workflowConfig;
