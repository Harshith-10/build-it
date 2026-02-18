import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {},
  allowedDevOrigins: [
    "localhost:3000",
    "172.16.7.253",
    "172.16.7.253:3000",
    "*.ngrok-free.app",
  ],
  poweredByHeader: false,
};

export default nextConfig;
