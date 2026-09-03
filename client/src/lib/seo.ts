import type { Metadata } from "next";

/**
 * Single source of truth for site-wide SEO values and structured data.
 *
 * Before this module existed the production origin was re-declared in five
 * separate files and several pages hardcoded `https://powermysport.com` into
 * `openGraph.url`. That is how the site once shipped canonicals pointing at a
 * host that redirects away. Everything that needs the origin now imports
 * `SITE_URL` or, better, uses a site-relative path and lets `metadataBase`
 * resolve it.
 */

/** Public origin, no trailing slash. Non-www — `www` 308s to the apex. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://powermysport.com").replace(
  /\/$/,
  ""
);

export const SITE_NAME = "PowerMySport";

export const SITE_DESCRIPTION =
  "PowerMySport helps parents plan their child's sports journey. Stage-by-stage sport pathways, searchable federation rankings, personalised guidance and 1:1 sessions with verified experts — free to explore, built for India.";

/** Shared social/preview assets. Site-relative; `metadataBase` makes them absolute. */
export const OG_IMAGE = "/og-image.png";
export const TWITTER_IMAGE = "/twitter-image.png";

/**
 * Organisation facts, kept here rather than inline in the homepage so every
 * schema block that names the company agrees with every other one. These mirror
 * what /contact shows a human — if that page changes, change this too.
 */
export const ORGANIZATION = {
  legalName: "Powermysport PVT. LTD.",
  email: "teams@powermysport.com",
  phone: "+91-89685-82443",
  addressLocality: "Mullanpur",
  addressRegion: "Punjab",
  addressCountry: "IN",
  foundingDate: "2024",
  /** Only profiles that actually exist. An invented `sameAs` is worse than none. */
  socialProfiles: ["https://www.instagram.com/powermysport"],
} as const;

/** Build an absolute URL from a site-relative path. */
export function absoluteUrl(path = "/"): string {
  if (!path || path === "/") return SITE_URL;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Collapse whitespace and clamp to a length search engines will actually show. */
export function clampText(input: string, max = 160): string {
  const text = (input || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Strip tags/entities from rich text so it is safe to use in a meta description. */
export function stripHtml(html: string): string {
  return (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, " ");
}

/**
 * Metadata for pages that must never appear in search results — auth screens,
 * onboarding funnels, and anything behind a session.
 *
 * These routes are deliberately *crawlable* (they are not in robots.ts's
 * disallow list). Google treats robots.txt as a crawl directive, not an
 * indexing one: a blocked URL that is linked from elsewhere on the site can
 * still be indexed URL-only, and it shows up in Search Console as "Blocked by
 * robots.txt". Letting Googlebot fetch the page and read `noindex` is the only
 * way to have it dropped from the index for good.
 */
export const NOINDEX_METADATA: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

/**
 * `NOINDEX_METADATA` plus a title, for the many private routes that had no
 * metadata at all and were therefore inheriting the root title *and* the root
 * canonical.
 */
export function noindexMetadata(title: string, description?: string): Metadata {
  return {
    title,
    ...(description ? { description } : {}),
    ...NOINDEX_METADATA,
  };
}

// ─── Structured data ──────────────────────────────────────────────────────────

export type JsonLdObject = Record<string, unknown>;

/**
 * BreadcrumbList structured data.
 *
 * Worth the few lines wherever a section is more than one level deep: it is how
 * Google renders the hierarchy in a result instead of a bare URL, and it tells
 * it that `/rankings/tennis/boys/u-14` sits under `/rankings/tennis` rather than
 * being a top-level page that happens to have slashes in it.
 *
 * Paths are site-relative; the absolute URL is built here so a caller can never
 * emit a hardcoded host — the wrong-host canonical was a real bug on this site
 * once and is not worth repeating.
 */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/** The company. Emitted once, on the homepage. */
export const organizationJsonLd: JsonLdObject = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  legalName: ORGANIZATION.legalName,
  url: SITE_URL,
  logo: absoluteUrl("/android-chrome-512x512.png"),
  description: SITE_DESCRIPTION,
  foundingDate: ORGANIZATION.foundingDate,
  areaServed: { "@type": "Country", name: "India" },
  address: {
    "@type": "PostalAddress",
    addressLocality: ORGANIZATION.addressLocality,
    addressRegion: ORGANIZATION.addressRegion,
    addressCountry: ORGANIZATION.addressCountry,
  },
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: ORGANIZATION.email,
      telephone: ORGANIZATION.phone,
      areaServed: "IN",
      availableLanguage: ["en", "hi"],
    },
  ],
  audience: {
    "@type": "Audience",
    audienceType: "Parents of young athletes in India",
  },
  sameAs: [...ORGANIZATION.socialProfiles],
};

/**
 * The site, with the sitelinks search box pointed at the pathway explorer —
 * the only site search that takes a free-text sport and returns something
 * useful.
 */
export const websiteJsonLd: JsonLdObject = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: "en-IN",
  publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/roadmap/{search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

/** FAQPage, for a page that genuinely renders every question and answer. */
export function faqJsonLd(items: { question: string; answer: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/**
 * A dated tournament. `SportsEvent` is the schema Google uses for event rich
 * results, and it is the single highest-value block on this site: parents
 * search for a specific event by name and date, which is exactly what the
 * edition pages hold.
 */
export function sportsEventJsonLd(input: {
  name: string;
  path: string;
  description?: string;
  startDate: string;
  endDate?: string;
  venue?: string;
  city?: string;
  state?: string;
  organiser?: string;
  status?: "announced" | "ongoing" | "completed" | "cancelled";
  sport?: string;
  registrationDeadlineDate?: string;
}): JsonLdObject {
  const url = absoluteUrl(input.path);
  const locationName = input.venue || input.city;

  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: input.name,
    url,
    ...(input.description ? { description: input.description } : {}),
    startDate: input.startDate,
    ...(input.endDate ? { endDate: input.endDate } : {}),
    eventStatus:
      input.status === "cancelled"
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(input.sport ? { sport: input.sport } : {}),
    ...(locationName
      ? {
          location: {
            "@type": "Place",
            name: locationName,
            address: {
              "@type": "PostalAddress",
              ...(input.city ? { addressLocality: input.city } : {}),
              ...(input.state ? { addressRegion: input.state } : {}),
              addressCountry: "IN",
            },
          },
        }
      : {}),
    ...(input.organiser
      ? { organizer: { "@type": "SportsOrganization", name: input.organiser } }
      : {}),
    // No `offers` block on purpose: the federation runs entry, we only publish
    // the fact sheet. Claiming an offer here would say we sell entry.
    ...(input.registrationDeadlineDate
      ? {
          additionalProperty: {
            "@type": "PropertyValue",
            name: "Registration deadline",
            value: input.registrationDeadlineDate,
          },
        }
      : {}),
  };
}

/** A federation / sport governing body. */
export function sportsOrganizationJsonLd(input: {
  name: string;
  acronym?: string;
  path: string;
  description?: string;
  sport?: string;
  founded?: number;
  headquarters?: string;
  website?: string;
  email?: string;
  phone?: string;
  socialLinks?: Record<string, string | undefined>;
}): JsonLdObject {
  const sameAs = [input.website, ...Object.values(input.socialLinks ?? {})].filter(
    (value): value is string => Boolean(value)
  );

  return {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    name: input.name,
    ...(input.acronym ? { alternateName: input.acronym } : {}),
    url: absoluteUrl(input.path),
    ...(input.description ? { description: input.description } : {}),
    ...(input.sport ? { sport: input.sport } : {}),
    ...(input.founded ? { foundingDate: String(input.founded) } : {}),
    ...(input.headquarters
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: input.headquarters,
            addressCountry: "IN",
          },
        }
      : {}),
    ...(input.email || input.phone
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "general",
            ...(input.email ? { email: input.email } : {}),
            ...(input.phone ? { telephone: input.phone } : {}),
          },
        }
      : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** An evergreen editorial guide — the sport resource pages. */
export function articleJsonLd(input: {
  headline: string;
  path: string;
  description?: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  section?: string;
  keywords?: string[];
}): JsonLdObject {
  const url = absoluteUrl(input.path);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.headline,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(input.description ? { description: input.description } : {}),
    image: absoluteUrl(input.image || OG_IMAGE),
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    ...(input.section ? { articleSection: input.section } : {}),
    ...(input.keywords?.length ? { keywords: input.keywords.join(", ") } : {}),
    inLanguage: "en-IN",
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/android-chrome-512x512.png"),
      },
    },
  };
}

/**
 * A bookable expert, as a `Person` who `makesOffer` a consultation.
 *
 * Ratings are only included when there are real reviews behind them — an
 * `aggregateRating` with `reviewCount: 0` is a structured-data error in Search
 * Console, not a neutral omission.
 */
export function expertJsonLd(input: {
  name: string;
  path: string;
  description?: string;
  image?: string;
  jobTitle?: string;
  sports?: string[];
  languages?: string[];
  city?: string;
  priceInr?: number;
  ratingValue?: number;
  reviewCount?: number;
}): JsonLdObject {
  const url = absoluteUrl(input.path);
  const hasRating =
    typeof input.ratingValue === "number" &&
    typeof input.reviewCount === "number" &&
    input.reviewCount > 0;

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: input.name,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(input.description ? { description: input.description } : {}),
    ...(input.image ? { image: input.image } : {}),
    ...(input.jobTitle ? { jobTitle: input.jobTitle } : {}),
    ...(input.sports?.length ? { knowsAbout: input.sports } : {}),
    ...(input.languages?.length ? { knowsLanguage: input.languages } : {}),
    ...(input.city
      ? {
          address: {
            "@type": "PostalAddress",
            addressLocality: input.city,
            addressCountry: "IN",
          },
        }
      : {}),
    worksFor: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    ...(typeof input.priceInr === "number"
      ? {
          makesOffer: {
            "@type": "Offer",
            priceCurrency: "INR",
            price: input.priceInr,
            availability: "https://schema.org/InStock",
            url,
            itemOffered: {
              "@type": "Service",
              name: `1:1 sports guidance session with ${input.name}`,
              serviceType: "Sports guidance consultation",
              provider: { "@type": "Person", name: input.name },
              areaServed: { "@type": "Country", name: "India" },
            },
          },
        }
      : {}),
    ...(hasRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: input.ratingValue,
            reviewCount: input.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

/**
 * A shop product.
 *
 * Prices arrive from the API in **paise** (see `lib/shop/format.ts`); schema.org
 * wants a decimal in the stated currency, so callers pass rupees and this does
 * not divide. Getting that backwards would advertise every product at 100× its
 * price in Google Shopping-style results.
 */
export function productJsonLd(input: {
  name: string;
  path: string;
  description?: string;
  images?: string[];
  sku?: string;
  brand?: string;
  category?: string;
  priceInr: number;
  inStock: boolean;
  condition?: "NEW" | "USED";
  ratingValue?: number;
  reviewCount?: number;
}): JsonLdObject {
  const url = absoluteUrl(input.path);
  const hasRating =
    typeof input.ratingValue === "number" &&
    typeof input.reviewCount === "number" &&
    input.reviewCount > 0;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    url,
    ...(input.description ? { description: input.description } : {}),
    ...(input.images?.length ? { image: input.images } : {}),
    ...(input.sku ? { sku: input.sku } : {}),
    ...(input.brand ? { brand: { "@type": "Brand", name: input.brand } } : {}),
    ...(input.category ? { category: input.category } : {}),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "INR",
      price: input.priceInr,
      availability: input.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition:
        input.condition === "USED"
          ? "https://schema.org/UsedCondition"
          : "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    },
    ...(hasRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: input.ratingValue,
            reviewCount: input.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

/**
 * An ordered list of links, for index pages whose whole value is the list —
 * ranking tables, the resources hub, the shop grid.
 */
export function itemListJsonLd(input: {
  name: string;
  path: string;
  items: { name: string; path: string }[];
  description?: string;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: input.name,
    url: absoluteUrl(input.path),
    ...(input.description ? { description: input.description } : {}),
    numberOfItems: input.items.length,
    itemListElement: input.items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  };
}
