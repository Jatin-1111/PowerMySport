import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/pathway", destination: "/find-sport", permanent: true },
      { source: "/guidance", destination: "/consult", permanent: true },
    ];
  },
  async rewrites() {
    return [
      // Base community route
      {
        source: "/community",
        destination:
          process.env.NODE_ENV === "development"
            ? "http://localhost:3002/community"
            : "https://community.powermysport.com/community",
      },
      // All nested community routes (e.g., /community/qna/123)
      {
        source: "/community/:path*",
        destination:
          process.env.NODE_ENV === "development"
            ? "http://localhost:3002/community/:path*"
            : "https://community.powermysport.com/community/:path*",
      },
    ];
  },
  /* config options here */
  reactCompiler: true,
  turbopack: {
    root: path.join(process.cwd(), ".."),
  },
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "media.istockphoto.com",
      },
      {
        protocol: "https",
        hostname: "via.placeholder.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.*.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "powermysport-images.s3.ap-south-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "powermysport-verification.s3.ap-south-1.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
