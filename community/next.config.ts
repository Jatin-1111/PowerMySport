import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/community",
  reactStrictMode: true,
  reactCompiler: true,
  turbopack: {
    root: path.join(process.cwd(), ".."),
  },
  // /q and /q/<id> were the live, indexed URLs for the Q&A feed before it was
  // renamed to /questions. Permanent redirects keep those inbound links and
  // Search Console entries pointing at the new canonical path.
  async redirects() {
    return [
      { source: "/q", destination: "/questions", permanent: true },
      {
        source: "/q/:postId",
        destination: "/questions/:postId",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        // Allow Next.js <Image> to load from the S3 chat bucket (public-read)
        protocol: "https",
        hostname: "*.amazonaws.com",
        pathname: "/**",
      },
      {
        // The CloudFront distribution in front of that bucket
        // (`NEXT_PUBLIC_CHAT_BUCKET_DOMAIN`). Without this, every blog cover
        // image served through the CDN fails `next/image` optimisation — and
        // cover images are also what `generateMetadata` hands to Open Graph.
        protocol: "https",
        hostname: "*.cloudfront.net",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
