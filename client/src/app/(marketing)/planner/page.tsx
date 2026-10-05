import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo";
import { PlannerApp } from "@/modules/planner/components/PlannerApp";
import { PageHeader } from "@/modules/shared/ui/PageHeader";
import type { Metadata } from "next";

/**
 * The season planner. The page itself is public so it can be found and read; the
 * personal part is drawn by `PlannerApp` once it knows who is looking.
 */

export const metadata: Metadata = {
  title: "Junior Tennis Tournament Planner for Parents",
  description:
    "Plan your child's tennis season. See which AITA junior tournaments they can enter at their age and rank, spot clashes and deadlines, and add events to Google Calendar.",
  alternates: { canonical: "/planner" },
  openGraph: {
    title: "Junior tennis tournament planner for parents",
    description:
      "See which AITA junior tournaments your child can enter at their age and rank, and plan the season.",
    url: "/planner",
    type: "website",
    siteName: "PowerMySport",
  },
};

export default function PlannerPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Season planner", path: "/planner" },
          ]),
        ]}
      />

      <div className="min-h-screen bg-slate-50">
        <PageHeader
          breadcrumbs={[{ label: "Season planner" }]}
          eyebrow="Tennis"
          title="Season planner"
          description="Plan your child's season around the tournaments they can actually enter. Events are checked against the federation's published entry rules for their age list and rank."
          width="5xl"
        />
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <PlannerApp />
        </div>
      </div>
    </>
  );
}
