import type { NextConfig } from "next";

const API_HOST = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

// Build a Content-Security-Policy string.
// Next.js App Router emits inline scripts for hydration, so script-src must
// include 'unsafe-inline'.  A nonce-based CSP via Middleware would remove that
// requirement but is a larger refactor; document here for future hardening.
// Razorpay requires https://checkout.razorpay.com for script + frame + connect.
const buildCSP = () => {
  const apiOrigin = API_HOST.startsWith("http") ? new URL(API_HOST).origin : API_HOST;
  return [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' ${apiOrigin} https://api.razorpay.com https://lumberjack.razorpay.com`,
    `frame-src https://api.razorpay.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `upgrade-insecure-requests`,
  ].join("; ");
};

const nextConfig: NextConfig = {
  // StrictMode double-invokes effects in dev to surface missing cleanups.
  // The singleton guards (silentRefreshOpPromise / silentRefreshPortalPromise)
  // already ensure only one refresh network call fires regardless of how many
  // times the effect runs, so StrictMode is safe to enable.
  reactStrictMode: true,

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
          // Security headers
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: buildCSP() },
        ],
      },
    ];
  },
};

export default nextConfig;
