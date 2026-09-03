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
      // The standalone venue/coach/academy listings are gone — /booking is the
      // one discovery surface, with a tab for each. These three were "launching
      // soon" waitlist pages and are indexed, so they redirect rather than 404.
      //
      // Deliberately exact paths: the DETAIL routes underneath them
      // (/venues/[venueId], /coaches/[coachId], /academies/[slug]) are live and
      // are what the booking tabs link to. A `:path*` here would break booking.
      {
        source: "/venues",
        destination: "/booking?tab=venues",
        permanent: true,
      },
      {
        source: "/coaches",
        destination: "/booking?tab=coaches",
        permanent: true,
      },
      {
        source: "/academies",
        destination: "/booking?tab=academies",
        permanent: true,
      },
      // Same story for the expert directory, collapsed into the Experts tab.
      // `/experts/[expertId]` and `/experts/sessions` underneath stay live and
      // are what that tab links to, so this stays an exact path too.
      {
        source: "/experts",
        destination: "/booking?tab=experts",
        permanent: true,
      },
      // Community shipped, so its "coming soon" waitlist page is gone. It was
      // indexed and sitemap-listed, so it redirects into the community app
      // rather than 404ing. `/community` is a rewrite (see below) — redirects
      // run first, so this resolves to the redirect, then the rewrite.
      {
        source: "/community-waitlist",
        destination: "/community",
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
  // @powermysport/shared-types ships raw .ts with no build step — Next
  // doesn't compile workspace packages by default, so this is required.
  transpilePackages: ["@powermysport/shared-types"],
  turbopack: {
    root: path.join(process.cwd(), ".."),
  },
  experimental: {
    // Next already auto-optimizes a default list of packages; naming these
    // explicitly is a cheap guarantee for the two icon/date libs this app
    // imports from broadly (lucide-react, date-fns) rather than relying on
    // whatever happens to be in that default list for this Next version.
    optimizePackageImports: ["lucide-react", "date-fns"],
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
