import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {},
  allowedDevOrigins: ["localhost:3000", "*.ngrok-free.app"],
};

export default nextConfig;
