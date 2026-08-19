import { JsonLd } from "@/components/seo/JsonLd";
import {
  breadcrumbJsonLd,
  clampText,
  expertJsonLd,
  NOINDEX_METADATA,
} from "@/lib/seo";
import type { Metadata } from "next";
import { ExpertDetailClient } from "./ExpertDetailClient";

/**
 * Server component for `/experts/[expertId]`.
 *
 * The interactive profile lives in `ExpertDetailClient`; this shell owns the
 * server-only work — `generateMetadata` and the `Person` schema crawlers need in
 * the initial HTML.
 *
 * This used to be a sibling `layout.tsx`, because the page itself was
 * `"use client"` and so could export neither `metadata` nor server-rendered
 * schema. With the page inverted, that workaround is unnecessary: the metadata
 * now sits on the route it describes, matching `federations/[slug]`.
 *
 * Only public fields are read here; `inPersonAddress`, email and payout details
 * are owner-only on the API and never reach this file.
 */
interface PublicExpert {
  id?: string;
  _id?: string;
  name?: string;
  bio?: string;
  sports?: string[];
  expertise?: string[];
  city?: string;
  languages?: string[];
  photoUrl?: string;
  sessionFee?: number;
  rating?: number;
  reviewCount?: number;
  isActive?: boolean;
}

async function fetchExpert(expertId: string): Promise<PublicExpert | null> {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  try {
    const res = await fetch(
      `${apiBase}/experts/${encodeURIComponent(expertId)}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const body = await res.json();
    return body?.success ? (body.data as PublicExpert) : null;
  } catch {
    return null;
  }
}

function expertDescription(expert: PublicExpert): string {
  const sports = expert.sports?.length ? expert.sports.join(", ") : "sport";
  return clampText(
    expert.bio ||
      `Book a 1:1 sports guidance session with ${expert.name ?? "this expert"} on PowerMySport — ${sports} guidance for parents and young athletes in India.`,
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ expertId: string }>;
}): Promise<Metadata> {
  const { expertId } = await params;
  const expert = await fetchExpert(expertId);

  // Unknown or deactivated expert — do not let an empty profile shell into the
  // index under a real person's URL.
  if (!expert || expert.isActive === false) {
    return { title: "Expert", ...NOINDEX_METADATA };
  }

  const name = expert.name ?? "PowerMySport Expert";
  const description = expertDescription(expert);
  const title = expert.sports?.length
    ? `${name} — ${expert.sports.join(", ")} expert`
    : name;

  return {
    title,
    description,
    alternates: { canonical: `/experts/${expertId}` },
    openGraph: {
      type: "profile",
      siteName: "PowerMySport",
      url: `/experts/${expertId}`,
      title,
      description,
      ...(expert.photoUrl ? { images: [{ url: expert.photoUrl }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(expert.photoUrl ? { images: [expert.photoUrl] } : {}),
    },
  };
}

export default async function ExpertDetailPage({
  params,
}: {
  params: Promise<{ expertId: string }>;
}) {
  const { expertId } = await params;
  const expert = await fetchExpert(expertId);
  const showSchema = expert && expert.isActive !== false && expert.name;

  return (
    <>
      {showSchema && (
        <JsonLd
          data={[
            expertJsonLd({
              name: expert.name as string,
              path: `/experts/${expertId}`,
              description: expertDescription(expert),
              ...(expert.photoUrl ? { image: expert.photoUrl } : {}),
              jobTitle: expert.expertise?.length
                ? expert.expertise.join(", ")
                : "Sports guidance expert",
              ...(expert.sports?.length ? { sports: expert.sports } : {}),
              ...(expert.languages?.length
                ? { languages: expert.languages }
                : {}),
              ...(expert.city ? { city: expert.city } : {}),
              // `sessionFee` is stored in whole rupees, unlike the shop's paise.
              ...(typeof expert.sessionFee === "number"
                ? { priceInr: expert.sessionFee }
                : {}),
              ...(expert.reviewCount
                ? {
                    ratingValue: expert.rating,
                    reviewCount: expert.reviewCount,
                  }
                : {}),
            }),
            breadcrumbJsonLd([
              { name: "Experts", path: "/experts" },
              { name: expert.name as string, path: `/experts/${expertId}` },
            ]),
          ]}
        />
      )}
      <ExpertDetailClient />
    </>
  );
}
