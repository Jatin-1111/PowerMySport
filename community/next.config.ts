import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/community",
  reactStrictMode: true,
  reactCompiler: true,
  turbopack: {
    root: path.join(process.cwd(), ".."),
  },
  images: {
    remotePatterns: [
      {
        // Allow Next.js <Image> to load from the S3 chat bucket (public-read)
        protocol: "https",
        hostname: "*.amazonaws.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
