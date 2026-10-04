import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/modules/shared/ui/PageHeader";

import { TRACKS } from "../config/tracks";
import { fetchOpportunities, type OpportunityTrack } from "../services/opportunities";
import { OpportunityBrowser } from "./OpportunityBrowser";

// ─── /admissions and /scholarships ───────────────────────────────────────
//
// One component for both: they are the same list of the same kind of record.
// This fetches and frames it; OpportunityBrowser lays it out, because how a
// list should look depends on how much there is and on who is looking.

export async function OpportunityIndex({
  track,
  sport,
}: {
  track: OpportunityTrack;
  sport?: string | undefined;
}) {
  const config = TRACKS[track];
  const data = await fetchOpportunities(track, sport);
  const items = data?.items ?? [];
  const sports = data?.sports ?? [];
  const selectedSport = sport && sports.includes(sport) ? sport : undefined;

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        breadcrumbs={[{ label: config.title }]}
        title={config.heading}
        description={config.intro}
      />

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700">
          <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
          <span>
            Every entry links the official source it was checked against and the date we last
            checked it. These rules change every year, so confirm on the source before you apply.
          </span>
        </p>

        <OpportunityBrowser
          track={track}
          items={items}
          sports={sports}
          categories={data?.categories ?? Object.keys(config.categories)}
          // Falls back to the server's own clock only if the API sent no date.
          today={data?.today ?? new Date().toISOString().slice(0, 10)}
          selectedSport={selectedSport}
        />
      </div>
    </div>
  );
}
