import { JsonLd } from "@/components/seo/JsonLd";
import { OG_IMAGE, organizationJsonLd, SITE_DESCRIPTION, websiteJsonLd } from "@/lib/seo";
import type { Metadata } from "next";

import HomeClient from "./HomeClient";

/**
 * The homepage body is a `"use client"` component (auth store, framer-motion),
 * so this thin server wrapper exists to own the two things a client component
 * cannot: the route's `metadata` and its structured data.
 *
 * The `Organization` and `WebSite` blocks are the site-wide identity schema and
 * live in `lib/seo.ts` so the community app's copy of them and this one cannot
 * drift apart.
 */
export const metadata: Metadata = {
  // `absolute`, not a plain string: the root layout's `%s | PowerMySport`
  // template is applied to any child title, and this one already leads with the
  // brand — the homepage was rendering
  // "PowerMySport | Guiding Every Sporting Journey | PowerMySport".
  title: { absolute: "PowerMySport | Guiding Every Sporting Journey" },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: "PowerMySport",
    title: "PowerMySport | Guiding Every Sporting Journey",
    description:
      "Plan your child's sports journey with AI-powered pathways, federation rankings, personalised guidance and verified experts across India. Free to explore.",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "PowerMySport | Guiding Every Sporting Journey",
      },
    ],
  },
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={[organizationJsonLd, websiteJsonLd]} />
      <HomeClient />
    </>
  );
}
