import { COMMUNITY_BASE_URL, communityUrl, LOGO_URL, SITE_NAME, SITE_URL } from "@/lib/seo";

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
 * Kept in step with the same block in the `client` app's `lib/seo.ts` — two
 * different `Organization` descriptions of one company on one domain is how a
 * knowledge-panel entity gets split in half. `sameAs` lists only profiles that
 * actually exist; an invented one is worse than an empty array.
 */
export const organizationSchema: JsonLdData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "PowerMySport",
  legalName: "Powermysport PVT. LTD.",
  url: SITE_URL,
  logo: LOGO_URL,
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
  sameAs: ["https://www.instagram.com/powermysport"],
};

/** WebSite schema scoped to the community app. */
export const websiteSchema: JsonLdData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: COMMUNITY_BASE_URL,
  inLanguage: "en-IN",
  publisher: { "@type": "Organization", name: "PowerMySport", url: SITE_URL },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${COMMUNITY_BASE_URL}/q?search={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
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
