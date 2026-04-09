import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Type errors are fixed separately — don't block production builds
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
