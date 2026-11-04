import { COMMUNITY_BASE_URL, communityUrl, SITE_NAME, SITE_URL } from "@/lib/seo";

type JsonLdData = Record<string, unknown>;

/**
 * Serialise a schema block for embedding in a `<script>` tag.
 *
 * Plain `JSON.stringify` is not enough here: blog titles, Q&A questions and
 * author bios are user-authored and flow straight into these blocks, so a
 * literal `</script>` in any of them would close the tag early and let the rest
 * be parsed as HTML. Escaping to unicode keeps the JSON identical to a parser
 * while making that impossible.
 */
function serialize(data: JsonLdData): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

/**
 * Renders one or more JSON-LD structured-data blocks. This is a server
 * component, so the schema is emitted in the initial HTML for crawlers.
 */
export function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
  const blocks = Array.isArray(data) ? data : [data];
  return (
    <>
      {blocks.map((block, index) => (
        <script
          // Structured-data blocks are static; index keys are stable here.
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serialize(block) }}
        />
      ))}
    </>
  );
}

/**
 * Organization schema for PowerMySport (shared across structured data).
 *
 * Kept in step with `organizationJsonLd` in the `client` app's `lib/seo.ts`: same
 * `@id`, same facts. Two different `Organization` descriptions of one company on
 * one domain is how a knowledge-panel entity gets split in half, and without a
 * shared `@id` this block was a second, unrelated Organization. `sameAs` lists
 * only profiles that actually exist; an invented one is worse than an empty array.
 */
export const organizationSchema: JsonLdData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "PowerMySport",
  legalName: "Powermysport PVT. LTD.",
  url: SITE_URL,
  logo: `${SITE_URL}/android-chrome-512x512.png`,
  description:
    "PowerMySport helps parents plan their child's sports journey. Stage-by-stage sport pathways, searchable federation rankings, personalised guidance and 1:1 sessions with verified experts, free to explore, built for India.",
  foundingDate: "2026",
  areaServed: { "@type": "Country", name: "India" },
  address: {
    "@type": "PostalAddress",
    addressLocality: "Mullanpur",
    addressRegion: "Punjab",
    addressCountry: "IN",
  },
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "teams@powermysport.com",
      telephone: "+91-89685-82443",
      areaServed: "IN",
      availableLanguage: ["en", "hi"],
    },
  ],
  audience: {
    "@type": "Audience",
    audienceType: "Parents of young athletes in India",
  },
  sameAs: [
    "https://www.instagram.com/powermysport",
    "https://www.linkedin.com/company/powermysport-pvt-ltd/",
  ],
};

/**
 * WebSite schema scoped to the community app. No `SearchAction`: its target was
 * `/q?search=`, a route this app does not have, and Google no longer shows the
 * sitelinks search box.
 */
export const websiteSchema: JsonLdData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: COMMUNITY_BASE_URL,
  inLanguage: "en-IN",
  publisher: { "@id": `${SITE_URL}/#organization` },
};

/**
 * BreadcrumbList for a section more than one level deep. Paths are relative to
 * the community base; `communityUrl` builds the absolute form so no caller can
 * hardcode an origin.
 */
export function breadcrumbSchema(trail: { name: string; path: string }[]): JsonLdData {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: communityUrl(crumb.path),
    })),
  };
}

/** An ordered list of links, for the index pages whose value *is* the list. */
export function itemListSchema(input: {
  name: string;
  path: string;
  description?: string;
  items: { name: string; path: string }[];
}): JsonLdData {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: input.name,
    url: communityUrl(input.path),
    ...(input.description ? { description: input.description } : {}),
    numberOfItems: input.items.length,
    itemListElement: input.items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: communityUrl(item.path),
    })),
  };
}
