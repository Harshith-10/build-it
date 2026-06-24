import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {},
  turbopack: {
    root: path.resolve(__dirname),
    resolveAlias: {
      tailwindcss: path.resolve(__dirname, "node_modules/tailwindcss"),
      "@tailwindcss/postcss": path.resolve(
        __dirname,
        "node_modules/@tailwindcss/postcss"
      ),
    },
  },
  allowedDevOrigins: [
    "localhost:3000",
    "172.16.7.253",
    "172.16.7.253:3000",
    "*.ngrok-free.app",
  ],
  poweredByHeader: false,
};

export default nextConfig;
