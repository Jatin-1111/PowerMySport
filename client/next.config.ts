import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/find-sport",
        destination: "/assessment",
        permanent: true,
      },
      // Tournament detail pages are gone — both the nested form and the flat
      // /tournaments/[slug] one. The nested URLs carry their federation slug, so
      // they keep their equity by landing on that federation's page (which has a
      // Tournaments tab). Flat /tournaments/[slug] URLs carry nothing we can map
      // to a destination, so they 404 rather than be funnelled somewhere
      // irrelevant — see the note on 410 in the handover.
      {
        source: "/federations/:slug/:tournamentSlug",
        destination: "/federations/:slug",
        permanent: true,
      },
      // Rankings moved under a sport segment so a second federation does not
      // have to inherit tennis-shaped URLs. These are indexed pages, so the old
      // paths 301 rather than 404.
      //
      // ORDER MATTERS. `/rankings/players/12345` and `/rankings/boys/u-14` are
      // both two segments, so the player rule has to be declared first or the
      // category rule swallows it and sends players to a nonsense URL.
      {
        source: "/rankings/players/:regNo",
        destination: "/rankings/tennis/players/:regNo",
        permanent: true,
      },
      {
        source: "/rankings/:category(boys|girls|men|women)/:subcategory",
        destination: "/rankings/tennis/:category/:subcategory",
        permanent: true,
      },
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
