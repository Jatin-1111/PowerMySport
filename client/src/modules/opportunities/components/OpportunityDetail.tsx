import { AlertTriangle, ExternalLink, Info } from "lucide-react";
import { PageHeader } from "@/modules/shared/ui/PageHeader";
import type { ReactNode } from "react";

import { OWNER_TYPE_LABELS, TRACKS } from "../config/tracks";
import type { Opportunity } from "../services/opportunities";
import { formatDay, sportsLabel, whereLabel } from "../utils/format";
import { AtAGlance } from "./AtAGlance";
import { EligibilityChecklist } from "./EligibilityChecklist";

// ─── One admission route or scholarship ─────────────────────────────────────
//
// Ordered by the questions a parent asks, in the order they ask them: what is
// this, what do we get and when, what do we do next (all in the at-a-glance
// block, which is the side rail on a wide screen and comes first on a phone),
// does our child qualify, what are the steps. The sources and the date we last
// checked come last but are never hidden, because every figure above them is
// only as good as they are.

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-slate-200 pt-8 first:border-t-0 first:pt-0">
      <h2 className="font-title text-xl font-extrabold text-slate-900">{title}</h2>
      <div className="mt-4 text-[15px] leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

export function OpportunityDetail({ opportunity }: { opportunity: Opportunity }) {
  const track = TRACKS[opportunity.track];
  const category = track.categories[opportunity.category];
  const keyDates = [...(opportunity.cycle?.keyDates ?? [])].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const facts = [
    sportsLabel(opportunity),
    whereLabel(opportunity.geography),
    category?.label,
    opportunity.cycle?.label ? `Rules for ${opportunity.cycle.label}` : null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        width="5xl"
        breadcrumbs={[{ label: track.title, href: track.path }, { label: opportunity.title }]}
        title={opportunity.title}
        description={
          opportunity.owner?.name
            ? `${opportunity.owner.name}${
                OWNER_TYPE_LABELS[opportunity.owner.type]
                  ? ` · ${OWNER_TYPE_LABELS[opportunity.owner.type]}`
                  : ""
              }`
            : undefined
        }
        meta={<span className="font-semibold text-slate-600">{facts.join(" · ")}</span>}
      />

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {opportunity.summary && (
          <p className="max-w-3xl text-[17px] leading-relaxed text-slate-800">
            {opportunity.summary}
          </p>
        )}

        {opportunity.stale && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              We last checked this more than a year ago, and the rules may have changed. Treat the
              official source as the final word.
            </span>
          </p>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          {/* First on a phone, so the answers and the next step come before the detail. */}
          <div className="lg:order-last">
            <AtAGlance opportunity={opportunity} />
          </div>

          <article className="min-w-0 space-y-8">
            <Section title="Who it is for">
              <EligibilityChecklist opportunity={opportunity} />
            </Section>

            {(opportunity.steps?.length ?? 0) > 0 && (
              <Section
                title={
                  opportunity.selection === "scouted" || opportunity.selection === "nominated"
                    ? "How players are picked"
                    : "What to do"
                }
              >
                <ol className="list-decimal space-y-2 pl-5">
                  {opportunity.steps!.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </Section>
            )}

            {keyDates.length > 0 && (
              <Section title="Key dates">
                <ul className="space-y-1.5">
                  {keyDates.map((d) => (
                    <li key={`${d.label}-${d.date}`} className="flex gap-3">
                      <span className="w-28 shrink-0 font-semibold text-slate-900">
                        {formatDay(d.date)}
                      </span>
                      <span>{d.label}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {(opportunity.keyFacts?.length ?? 0) > 0 && (
              <Section title="Good to know">
                <ul className="list-disc space-y-2 pl-5">
                  {opportunity.keyFacts!.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title="Sources">
              {opportunity.lastVerifiedOn && (
                <p className="text-[14px] text-slate-600">
                  Last checked by PowerMySport on {formatDay(opportunity.lastVerifiedOn)}.
                </p>
              )}
              {opportunity.verificationNote && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-slate-100 p-3 text-[14px] text-slate-700">
                  <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <span>{opportunity.verificationNote}</span>
                </p>
              )}
              <ul className="mt-3 space-y-2">
                {(opportunity.sources ?? []).map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-start gap-1.5 font-semibold text-orange-700 hover:text-orange-800 hover:underline"
                    >
                      <span>{source.label}</span>
                      <ExternalLink aria-hidden className="mt-1 h-3.5 w-3.5 shrink-0" />
                    </a>
                    {source.publishedOn && (
                      <span className="ml-2 text-[13px] text-slate-500">
                        {formatDay(source.publishedOn)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          </article>
        </div>
      </div>
    </div>
  );
}
