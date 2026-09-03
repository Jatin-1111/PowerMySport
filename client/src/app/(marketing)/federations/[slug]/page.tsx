import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, clampText, NOINDEX_METADATA, sportsOrganizationJsonLd } from "@/lib/seo";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchPublishedPathways } from "@/modules/pathway/services/fetchGuide";
import { FederationDetailClient } from "./FederationDetailClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EligibilityCategory {
  name: string;
  maxAge: number;
  genders: string[];
  minRanking?: string;
  notes?: string;
}

interface EligibilityCriteria {
  ageCutoffRule?: string;
  categories: EligibilityCategory[];
  registrationRequired: boolean;
  stateAssociationFirst: boolean;
  notes?: string;
}

interface StateAssociation {
  name: string;
  state: string;
  website?: string;
}

export interface FederationDetail {
  _id: string;
  slug: string;
  name: string;
  acronym: string;
  sportSlug: string;
  type: "govt" | "national" | "hybrid";
  about: string;
  founded?: number;
  headquarters?: string;
  website?: string;
  officialCalendarUrl?: string;
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    facebook?: string;
    youtube?: string;
  };
  affiliations?: string[];
  stateAssociations?: StateAssociation[];
  keyFacts?: string[];
  eligibilityCriteria?: EligibilityCriteria;
  registrationSteps?: string[];
  requiredDocuments?: string[];
  contact?: {
    email?: string;
    phone?: string;
    address?: string;
  };
  dataVerifiedAt?: string;
  sourceUrls?: string[];
}

// ─── Server fetch ─────────────────────────────────────────────────────────────

async function fetchFederation(slug: string): Promise<FederationDetail | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  try {
    const res = await fetch(`${apiBase}/federations/${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.success ? (body.data as FederationDetail) : null;
  } catch {
    return null;
  }
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const fed = await fetchFederation(slug);
  if (!fed) return { title: "Federation", ...NOINDEX_METADATA };
  return {
    title: `${fed.name} (${fed.acronym})`,
    description: clampText(fed.about, 155),
    alternates: { canonical: `/federations/${fed.slug}` },
    openGraph: {
      title: `${fed.acronym} — ${fed.name}`,
      description: clampText(fed.about, 200),
      // Site-relative — `metadataBase` resolves it. See lib/seo.ts.
      url: `/federations/${fed.slug}`,
      type: "website",
      siteName: "PowerMySport",
    },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function FederationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab } = await searchParams;
  const fed = await fetchFederation(slug);
  if (!fed) notFound();

  // Whether the back-link has anywhere to go. Only the CMS knows which sports
  // are published, and a federation can exist for a sport with no guide yet.
  const published = await fetchPublishedPathways();
  const hasPathway = published.some((guide) => guide.sportSlug === fed.sportSlug);

  const validTabs = ["overview", "tournaments", "calendar", "eligibility", "register"] as const;
  type TabId = (typeof validTabs)[number];
  const initialTab: TabId = validTabs.includes(tab as TabId) ? (tab as TabId) : "overview";

  return (
    <>
      {/* The client component below cannot emit schema into the initial HTML,
          so it is rendered here where crawlers will see it. */}
      <JsonLd
        data={[
          sportsOrganizationJsonLd({
            name: fed.name,
            acronym: fed.acronym,
            path: `/federations/${fed.slug}`,
            description: clampText(fed.about, 500),
            sport: fed.sportSlug,
            ...(fed.founded ? { founded: fed.founded } : {}),
            ...(fed.headquarters ? { headquarters: fed.headquarters } : {}),
            ...(fed.website ? { website: fed.website } : {}),
            ...(fed.contact?.email ? { email: fed.contact.email } : {}),
            ...(fed.contact?.phone ? { phone: fed.contact.phone } : {}),
            ...(fed.socialLinks ? { socialLinks: fed.socialLinks } : {}),
          }),
          // Mirrors the URL hierarchy now that /federations exists. It pointed
          // at /rankings while this page had no parent index — a breadcrumb to
          // a path the URL isn't under.
          breadcrumbJsonLd([
            { name: "Federations", path: "/federations" },
            { name: fed.acronym, path: `/federations/${fed.slug}` },
          ]),
        ]}
      />
      <FederationDetailClient federation={fed} initialTab={initialTab} hasPathway={hasPathway} />
    </>
  );
}
