/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  distDir: "dist",
  images: {
    unoptimized: true,
  },
  experimental: {
    // AGENT-TRACE: optimizePackageImports for fast build times and minimal client JS
    optimizePackageImports: [
      "lucide-react",
      "@xyflow/react",
      "clsx",
      "tailwind-merge",
      "@radix-ui/react-tabs",
    ],
    // Inlines critical CSS chunks directly into HTML output
    inlineCss: true,
    // Injects detailed attribution info into Web Vitals
    webVitalsAttribution: ["CLS", "LCP", "FCP", "TTFB", "INP"],
  },
};

export default nextConfig;
