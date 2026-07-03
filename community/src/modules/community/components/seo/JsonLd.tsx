import { COMMUNITY_BASE_URL, LOGO_URL, SITE_NAME, SITE_URL } from "@/lib/seo";

type JsonLdData = Record<string, unknown>;

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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </>
  );
}

/** Organization schema for PowerMySport (shared across structured data). */
export const organizationSchema: JsonLdData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "PowerMySport",
  url: SITE_URL,
  logo: LOGO_URL,
  sameAs: [],
};

/** WebSite schema scoped to the community app. */
export const websiteSchema: JsonLdData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: COMMUNITY_BASE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${COMMUNITY_BASE_URL}/q?search={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};
