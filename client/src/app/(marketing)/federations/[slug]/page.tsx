import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  try {
    const res = await fetch(
      `${apiBase}/federations/${encodeURIComponent(slug)}`,
      { next: { revalidate: 3600 } },
    );
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
  if (!fed) return { title: "Federation — PowerMySport" };
  return {
    title: `${fed.name} (${fed.acronym}) — PowerMySport`,
    description: fed.about.slice(0, 155),
    alternates: { canonical: `/federations/${fed.slug}` },
    openGraph: {
      title: `${fed.acronym} — ${fed.name}`,
      description: fed.about.slice(0, 200),
      url: `https://powermysport.com/federations/${fed.slug}`,
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

  const validTabs = ["overview", "tournaments", "eligibility", "register"] as const;
  type TabId = (typeof validTabs)[number];
  const initialTab: TabId = validTabs.includes(tab as TabId)
    ? (tab as TabId)
    : "overview";

  return <FederationDetailClient federation={fed} initialTab={initialTab} />;
}
