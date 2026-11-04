import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seo";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OpportunityDetail } from "@/modules/opportunities/components/OpportunityDetail";
import { TRACKS } from "@/modules/opportunities/config/tracks";
import { fetchOpportunity } from "@/modules/opportunities/services/opportunities";

const TRACK = "scholarship" as const;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const opportunity = await fetchOpportunity(slug);
  if (!opportunity || opportunity.track !== TRACK) return { title: TRACKS[TRACK].title };

  const path = `${TRACKS[TRACK].path}/${opportunity.slug}`;
  const description = (opportunity.summary ?? opportunity.benefit?.summary ?? "").slice(0, 300);
  return {
    title: opportunity.title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: opportunity.title,
      description,
      url: path,
      type: "article",
      siteName: "PowerMySport",
    },
  };
}

export default async function ScholarshipsDetailPage({ params }: Params) {
  const { slug } = await params;
  const opportunity = await fetchOpportunity(slug);
  // A scholarship's slug under /admissions is not a page, not a redirect.
  if (!opportunity || opportunity.track !== TRACK) notFound();
  const config = TRACKS[TRACK];
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: opportunity.title,
            path: `${config.path}/${opportunity.slug}`,
            ...(opportunity.summary ? { description: opportunity.summary } : {}),
            // The date the page itself prints as "Last checked by PowerMySport".
            ...(opportunity.lastVerifiedOn ? { dateModified: opportunity.lastVerifiedOn } : {}),
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: config.title, path: config.path },
            { name: opportunity.title, path: `${config.path}/${opportunity.slug}` },
          ]),
        ]}
      />
      <OpportunityDetail opportunity={opportunity} />
    </>
  );
}
