import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // No build-time env reads; runtime env is read from server route handlers only.
};

export default nextConfig;
