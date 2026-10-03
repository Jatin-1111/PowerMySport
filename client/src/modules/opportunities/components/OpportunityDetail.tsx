import { AlertTriangle, ChevronRight, ExternalLink, Info } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { OWNER_TYPE_LABELS, SELECTION_LABELS, TRACKS } from "../config/tracks";
import type { Opportunity } from "../services/opportunities";
import { cycleLine, formatAmount, formatDay, sportsLabel, whereLabel } from "../utils/format";

// ─── One admission route or scholarship ─────────────────────────────────────
//
// Ordered by what a parent needs to decide: can we still act on it this year,
// what does it give, is my child eligible, what do we do. The sources and the
// date we last checked come last but are never hidden, because every figure
// above them is only as good as they are.

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-slate-100 pt-6">
      <h2 className="font-title text-lg font-extrabold text-slate-900">{title}</h2>
      <div className="mt-3 text-[15px] leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

function eligibilityLines(e: Opportunity["eligibility"]): Array<[string, string]> {
  if (!e) return [];
  const lines: Array<[string, string]> = [];
  const ages =
    e.ageMin !== undefined && e.ageMax !== undefined
      ? `${e.ageMin} to ${e.ageMax}`
      : e.ageMax !== undefined
        ? `Up to ${e.ageMax}`
        : e.ageMin !== undefined
          ? `${e.ageMin} and over`
          : null;
  if (ages || e.ageNote) lines.push(["Age", [ages, e.ageNote].filter(Boolean).join(". ")]);
  if (e.gender === "female") lines.push(["Who", "Girls and women only"]);
  if (e.gender === "male") lines.push(["Who", "Boys and men only"]);
  if (e.level) lines.push(["Sporting level", e.level]);
  if (e.academic) lines.push(["Academic", e.academic]);
  if (e.income) lines.push(["Income", e.income]);
  return lines;
}

export function OpportunityDetail({ opportunity }: { opportunity: Opportunity }) {
  const track = TRACKS[opportunity.track];
  const category = track.categories[opportunity.category];
  const selection = opportunity.selection ? SELECTION_LABELS[opportunity.selection] : null;
  const amount = formatAmount(opportunity.benefit?.amount);
  const cycle = cycleLine(opportunity);
  const eligibility = eligibilityLines(opportunity.eligibility);
  const keyDates = [...(opportunity.cycle?.keyDates ?? [])].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const canApply =
    opportunity.applyUrl &&
    opportunity.cycleState !== "closed" &&
    (opportunity.selection === "apply" || opportunity.selection === "trials");
  const facts = [
    sportsLabel(opportunity),
    whereLabel(opportunity.geography),
    category?.label,
    opportunity.cycle?.label ? `Rules for ${opportunity.cycle.label}` : null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="from-power-orange bg-gradient-to-br to-orange-600 px-4 pb-10 pt-14 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <nav aria-label="Breadcrumb" className="mb-3 text-[13px] font-semibold text-orange-50">
            <Link href={track.path} className="hover:text-white hover:underline">
              {track.title}
            </Link>
            <ChevronRight aria-hidden className="mx-1 inline h-3.5 w-3.5" />
            <span className="text-white">{category?.label ?? opportunity.title}</span>
          </nav>
          <h1 className="font-title text-2xl font-extrabold leading-tight text-white sm:text-3xl">
            {opportunity.title}
          </h1>
          {opportunity.owner?.name && (
            <p className="mt-2 text-sm text-orange-50">
              {opportunity.owner.name}
              {OWNER_TYPE_LABELS[opportunity.owner.type]
                ? ` · ${OWNER_TYPE_LABELS[opportunity.owner.type]}`
                : ""}
            </p>
          )}
          <p className="mt-3 text-[13px] font-semibold text-white/90">{facts.join(" · ")}</p>
        </div>
      </div>

      <article className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        {opportunity.stale && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              We last checked this more than a year ago, and the rules may have changed. Treat the
              official source as the final word.
            </span>
          </p>
        )}

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          {selection && (
            <p className="text-[15px] font-bold text-slate-900">
              {selection.label}.{" "}
              <span className="font-normal text-slate-600">{selection.explain}</span>
            </p>
          )}
          {cycle && <p className="mt-2 text-[14px] text-slate-600">{cycle}</p>}
          {canApply && (
            <a
              href={opportunity.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-power-orange-solid mt-4 inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-bold text-white transition hover:bg-orange-700"
            >
              Go to the official application
              <ExternalLink aria-hidden className="h-4 w-4" />
            </a>
          )}
        </div>

        {opportunity.summary && (
          <p className="text-[16px] leading-relaxed text-slate-700">{opportunity.summary}</p>
        )}

        {opportunity.benefit?.summary && (
          <Section title="What it gives">
            <p>{opportunity.benefit.summary}</p>
            {amount && <p className="mt-2 font-semibold text-slate-900">{amount}</p>}
          </Section>
        )}

        {eligibility.length > 0 && (
          <Section title="Who it is for">
            <dl className="space-y-3">
              {eligibility.map(([label, value]) => (
                <div key={label} className="grid gap-1 sm:grid-cols-[150px_minmax(0,1fr)]">
                  <dt className="text-[13px] font-bold text-slate-500">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </Section>
        )}

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
  );
}
