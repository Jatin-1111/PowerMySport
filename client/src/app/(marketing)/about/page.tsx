import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/JsonLd";
import { aboutPageJsonLd, breadcrumbJsonLd } from "@/lib/seo";

import { AboutPageContent } from "./AboutPageContent";

// ─── /about ──────────────────────────────────────────────────────────────────
//
// The page that says who we are, so it is also the page a crawler should be
// able to read that from. It shipped with no structured data at all: the live
// HTML carried zero ld+json blocks, which left the one page explicitly about
// the company saying nothing machine-readable about it.

const TITLE = "About PowerMySport, Why We Built This";
const DESCRIPTION =
  "Who we are and why we built PowerMySport: a small team in Punjab writing down what Indian youth sport never wrote down for parents. What is free today, how we are funded, and how we handle a child's data.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/about",
    type: "website",
    siteName: "PowerMySport",
  },
};

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={[
          aboutPageJsonLd({ name: TITLE, description: DESCRIPTION, path: "/about" }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
        ]}
      />
      <AboutPageContent />
    </>
  );
}
