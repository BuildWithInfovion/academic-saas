import type { NextConfig } from "next";

const API_HOST = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Compress all responses (gzip/br)
  compress: true,

  // Trim unused exports from imported packages to reduce JS bundle size
  experimental: {
    optimizePackageImports: ["zustand"],
  },

  // HTTP response headers
  async headers() {
    return [
      // ── Static assets built by Next.js get a content-hash in their filename,
      // so they can be cached indefinitely by both the browser and any CDN.
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // ── Favicon and other public-folder files: cache for a day
      {
        source: "/:file(favicon.ico|robots.txt|sitemap.xml|manifest.json)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      // ── HTML pages: never cache (always fresh SSR/SSG shell)
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          // Basic security headers
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
