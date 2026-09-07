import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        // Proxy all /api/v1/* requests to the FastAPI backend
        source: "/api/v1/:path*",
        destination: process.env.FASTAPI_URL ? `${process.env.FASTAPI_URL}/api/v1/:path*` : "http://127.0.0.1:8000/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
