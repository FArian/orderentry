import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" is required for Docker deployment.
  // On Vercel, VERCEL env var is set automatically — standalone must be disabled there.
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
