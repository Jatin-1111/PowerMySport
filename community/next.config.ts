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
  //
  // /blog/* is the same situation for the blog-to-Experience rename: these
  // URLs are in the sitemap and indexed, so per the GSC remediation history
  // (see project_gsc_indexing_remediation) these redirects are
  // release-blocking, not a nice-to-have. IDs are preserved by migration 39,
  // so every mapping below is 1:1 — no lookup needed.
  //
  // Order matters: Next.js redirects are checked in order, and a static
  // segment like `/blog/write` would otherwise never be reached if a generic
  // `/blog/:blogId` came first and matched "write" as an id. The specific
  // paths are listed before the catch-all for that reason.
  async redirects() {
    return [
      { source: "/q", destination: "/questions", permanent: true },
      {
        source: "/q/:postId",
        destination: "/questions/:postId",
        permanent: true,
      },
      { source: "/blog/write", destination: "/experiences/new", permanent: true },
      { source: "/blog/account", destination: "/experiences/account", permanent: true },
      {
        source: "/blog/edit/:blogId",
        destination: "/experiences/:blogId/edit",
        permanent: true,
      },
      {
        source: "/blog/writer/:identifier",
        destination: "/experiences/by/:identifier",
        permanent: true,
      },
      { source: "/blog", destination: "/experiences", permanent: true },
      {
        source: "/blog/:blogId",
        destination: "/experiences/:blogId",
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
