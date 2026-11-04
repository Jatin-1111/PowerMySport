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
          title="Season planner"
          description="Tennis tournaments your child can actually enter, checked against the federation's entry rules for their age and rank."
          width="7xl"
          size="compact"
        />
        <div className="mx-auto max-w-7xl px-4 pb-32 pt-8 sm:px-6 sm:pb-8 lg:px-8">
          <PlannerApp />
        </div>
      </div>
    </>
  );
}
