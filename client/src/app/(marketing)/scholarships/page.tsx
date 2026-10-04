import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, NOINDEX_METADATA } from "@/lib/seo";
import type { Metadata } from "next";
import { OpportunityIndex } from "@/modules/opportunities/components/OpportunityIndex";
import { TRACKS } from "@/modules/opportunities/config/tracks";
import { fetchOpportunities } from "@/modules/opportunities/services/opportunities";
import { describeListing } from "@/modules/opportunities/utils/format";

const TRACK = "scholarship" as const;

export async function generateMetadata(): Promise<Metadata> {
  const config = TRACKS[TRACK];
  const title = `${config.heading} for young athletes in India`;
  // An empty list is a page with nothing on it yet; keep it out of the index
  // until something has been verified and published.
  const data = await fetchOpportunities(TRACK);
  const empty = data !== null && data.items.length === 0;
  // Names what is actually published, so the description cannot promise schemes
  // that have not been added.
  const description = describeListing(
    config.metaDescription,
    (data?.items ?? []).map((item) => item.title)
  );
  return {
    title,
    description,
    alternates: { canonical: config.path },
    ...(empty ? NOINDEX_METADATA : {}),
    openGraph: {
      title,
      description,
      url: config.path,
      type: "website",
      siteName: "PowerMySport",
    },
  };
}

export default async function ScholarshipsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sport } = await searchParams;
  const config = TRACKS[TRACK];
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: config.title, path: config.path },
        ])}
      />
      <OpportunityIndex
        track={TRACK}
        sport={typeof sport === "string" ? sport.trim().toLowerCase() || undefined : undefined}
      />
    </>
  );
}
