import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, sportsEventJsonLd } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Clock,
  ExternalLink,
  FileText,
  Info,
  ListChecks,
  MapPin,
  Trophy,
} from "lucide-react";
import type { EditionDocument, TournamentEditionDetail } from "@/modules/pathway/services/pathway";
import ParentExperiencesBand from "@/modules/community/components/ParentExperiencesBand";
import {
  CAL_TZ,
  formatLocation,
  hasEditionFinished,
  levelColor,
} from "../../federations/[slug]/editionUtils";
import { AddToCalendarButton } from "../../federations/[slug]/AddToCalendarButton";
import { SPORT_LABEL } from "../../federations/[slug]/federationShared";

import { groupDocumentsByKind } from "./documentGroups";

/**
 * One dated tournament — the August 2026 running of AITA's Championship Series
 * in Delhi, not the evergreen "Championship Series" concept.
 *
 * Everything here comes from the federation's own page for that event, pulled
 * in by the data-source detail pass; nothing on this page is inferred. That is
 * deliberate: an earlier /tournaments/[slug] route generated most of its body
 * from the tournament's level and prestige, which read as authoritative while
 * being guesswork. If a field is missing here, it is simply not shown.
 */

// ─── Server fetch ─────────────────────────────────────────────────────────────

/**
 * Deliberately shorter than the hour used elsewhere on the marketing site.
 *
 * The question this page exists to answer — "is the fact sheet up yet?" — is
 * exactly the one that changes, and it changes the moment an admin approves a
 * source. At an hour's cache a parent is told "no fact sheet published yet"
 * while the link is already live, which is worse than showing nothing at all.
 * The read behind it is a single indexed lookup, so a minute costs very little.
 *
 * The tag is here so this can become instant later: have the approve action
 * call revalidateTag("tournament-editions") instead of waiting out the window.
 */
const EDITION_REVALIDATE_SECONDS = 60;

async function fetchEdition(slug: string): Promise<TournamentEditionDetail | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  try {
    const res = await fetch(`${apiBase}/tournament-editions/${encodeURIComponent(slug)}`, {
      next: { revalidate: EDITION_REVALIDATE_SECONDS, tags: ["tournament-editions"] },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.success ? (body.data as TournamentEditionDetail) : null;
  } catch {
    return null;
  }
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function formatFullDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: CAL_TZ,
  });
}

function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: CAL_TZ,
  });
}

const DOCUMENT_META: Record<EditionDocument["kind"], { label: string; hint: string }> = {
  factSheet: {
    label: "Fact sheet",
    hint: "Entry fee, entry deadline, format and venue rules — read this before entering.",
  },
  acceptanceList: {
    label: "Acceptance list",
    hint: "Who has been accepted into the draw.",
  },
  entryForm: { label: "Entry form", hint: "Submit this to enter." },
  draw: { label: "Draw", hint: "Match-ups and seedings." },
  results: { label: "Results", hint: "Final results for this event." },
  other: { label: "Document", hint: "Published alongside this tournament." },
};

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const detail = await fetchEdition(slug);
  if (!detail) return { title: "Tournament" };

  const { edition, nextInSeries } = detail;

  const title = edition.officialName || edition.name;
  const where = formatLocation(edition.venue, edition.city);
  const finished = hasEditionFinished(edition);

  // A finished event is still the thing people search for weeks afterwards, and
  // at that point "starts 11 Aug" is the wrong promise — it reads as an event
  // you can still enter. Say it is over and name what comes next, because the
  // snippet is where most of these searchers decide, not the page.
  const description = (
    finished
      ? [
          `${title} took place on ${formatShortDate(edition.startDate)}`,
          where ? `at ${where}` : null,
          nextInSeries
            ? `— the next edition is ${formatShortDate(nextInSeries.startDate)}.`
            : `— see upcoming ${edition.sportSlug} tournaments${edition.city ? ` in ${edition.city}` : ""}.`,
        ]
      : [
          `${title} starts ${formatShortDate(edition.startDate)}`,
          where ? `at ${where}` : null,
          edition.ageGroups?.length ? `for ${edition.ageGroups.join(", ")}` : null,
        ]
  )
    .filter(Boolean)
    .join(" ")
    .slice(0, 155);

  // Many edition names are internal federation shorthand ("CS7 Delhi") with no
  // sport or "tournament" in sight — a page can rank well for that name and
  // still get skipped in the SERP because nothing confirms what it's for.
  // Names that already read as a tournament (most chess listings do) are left
  // alone rather than padded with a redundant suffix.
  const sportLabel = SPORT_LABEL[edition.sportSlug] ?? edition.sportSlug;
  const nameLower = edition.name.toLowerCase();
  const hasContext =
    nameLower.includes("tournament") || nameLower.includes(sportLabel.toLowerCase());
  const metaTitle = [
    edition.name,
    hasContext ? null : `${sportLabel} Tournament`,
    formatShortDate(edition.startDate),
    // A known next running is the one genuinely clickable fact we have for a
    // finished event, so it earns the slot the city would otherwise take.
    finished && nextInSeries
      ? `Next edition ${formatShortDate(nextInSeries.startDate)}`
      : edition.city || null,
  ]
    .filter(Boolean)
    .join(" — ");

  return {
    title: metaTitle,
    description,
    alternates: { canonical: `/tournaments/${edition.slug}` },
    openGraph: {
      title,
      description,
      // Site-relative: `metadataBase` makes it absolute on whatever host is
      // serving. Hardcoding the origin here is how this site once shipped
      // canonicals pointing at a host that redirects away.
      url: `/tournaments/${edition.slug}`,
      type: "website",
      siteName: "PowerMySport",
    },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TournamentEditionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const detail = await fetchEdition(slug);
  if (!detail) notFound();

  const { edition, federation, related, nextInSeries } = detail;
  const location = formatLocation(edition.venue, edition.city);
  const lc = edition.level ? levelColor(edition.level) : null;
  const finished = hasEditionFinished(edition);
  const multiDay =
    !!edition.endDate &&
    new Date(edition.endDate).toISOString().slice(0, 10) !==
      new Date(edition.startDate).toISOString().slice(0, 10);

  const documents = edition.documents ?? [];
  const factSheet = documents.find((d) => d.kind === "factSheet");
  const otherDocuments = documents.filter((d) => d !== factSheet);

  const facts: Array<{ icon: React.ReactNode; label: string; value: string }> = [
    {
      icon: <CalendarDays className="h-4 w-4" />,
      label: multiDay ? "Dates" : "Date",
      value: multiDay
        ? `${formatFullDate(edition.startDate)} – ${formatShortDate(edition.endDate!)}`
        : formatFullDate(edition.startDate),
    },
    ...(location
      ? [{ icon: <MapPin className="h-4 w-4" />, label: "Venue", value: location }]
      : []),
    ...(edition.state
      ? [{ icon: <MapPin className="h-4 w-4" />, label: "State", value: edition.state }]
      : []),
    ...(edition.organiser
      ? [{ icon: <Building2 className="h-4 w-4" />, label: "Organiser", value: edition.organiser }]
      : []),
    ...(edition.category
      ? [{ icon: <Trophy className="h-4 w-4" />, label: "Category", value: edition.category }]
      : []),
    ...(edition.registrationDeadlineDate
      ? [
          {
            icon: <Clock className="h-4 w-4" />,
            label: "Entries close",
            value: formatShortDate(edition.registrationDeadlineDate),
          },
        ]
      : []),
  ];

  // The one page on this site with everything an Event rich result needs — a
  // name, real dates, a place and an organiser — and parents search for exactly
  // this ("AITA CS7 Delhi August"). No `offers` block: the federation runs
  // entry, we only mirror the fact sheet.
  const eventPath = `/tournaments/${edition.slug ?? slug}`;

  return (
    <main className="min-h-screen">
      <JsonLd
        data={[
          sportsEventJsonLd({
            name: edition.officialName || edition.name,
            path: eventPath,
            startDate: edition.startDate,
            ...(edition.endDate ? { endDate: edition.endDate } : {}),
            ...(edition.venue ? { venue: edition.venue } : {}),
            ...(edition.city ? { city: edition.city } : {}),
            ...(edition.state ? { state: edition.state } : {}),
            organiser: edition.organiser || federation?.name,
            status: edition.status,
            sport: edition.sportSlug,
            ...(edition.registrationDeadlineDate
              ? { registrationDeadlineDate: edition.registrationDeadlineDate }
              : {}),
          }),
          breadcrumbJsonLd([
            ...(federation
              ? [{ name: federation.name, path: `/federations/${federation.slug}` }]
              : []),
            { name: edition.name, path: eventPath },
          ]),
        ]}
      />

      {/* ── Hero ── */}
      <div className="bg-deep-slate">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          {federation && (
            <div className="border-b border-white/[0.07] pb-4 pt-5">
              <Link
                href={`/federations/${federation.slug}?tab=calendar`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/50 transition hover:text-white"
              >
                <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                {federation.acronym} calendar
              </Link>
            </div>
          )}

          <div className="mb-5 mt-6 flex flex-wrap items-center gap-2">
            {finished && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-400/30 bg-slate-400/15 px-3 py-1 text-[11px] font-bold text-white/70">
                <Clock className="h-3 w-3" />
                Finished
              </span>
            )}
            {edition.level && lc && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${lc.pill}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${lc.dot}`} />
                {edition.level}
              </span>
            )}
            {edition.ageGroups?.map((ag) => (
              <span
                key={ag}
                className="inline-flex items-center rounded-full border border-white/[0.12] bg-white/[0.07] px-3 py-1 text-[11px] font-semibold text-white/60"
              >
                {ag}
              </span>
            ))}
          </div>

          <h1 className="font-title text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-[3rem]">
            {edition.officialName || edition.name}
          </h1>
          {/* The short calendar name is what the federation's own calendar prints,
              so keep it visible when the official title differs — parents match
              on it when cross-checking the source. */}
          {edition.officialName && edition.officialName !== edition.name && (
            <p className="mt-2 text-sm font-semibold text-white/40">
              Listed on the calendar as “{edition.name}”
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-5 text-sm text-white/60">
            <span className="flex items-center gap-1.5 font-semibold text-white/80">
              <CalendarDays className="h-4 w-4" />
              {formatFullDate(edition.startDate)}
            </span>
            {location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {location}
              </span>
            )}
          </div>

          {/* Nothing to add to a calendar once the event is over. */}
          <div className={finished ? "pb-8" : "pb-8 pt-5"}>
            {!finished && <AddToCalendarButton edition={edition} variant="hero" />}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {/* ── Finished: say so, then move them forward ──
            These pages keep ranking for months after the event and are 62% of
            all tournament impressions, at less than half the click-through of
            an upcoming one. The entry paperwork below is no use to whoever is
            reading now, so the next running goes above it. */}
        {finished && (
          <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <h2 className="font-title text-deep-slate text-xl font-bold">
                  This event has finished
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  It ran on {formatFullDate(edition.endDate || edition.startDate)}
                  {location ? ` at ${location}` : ""}. We mirror federation calendars and entry
                  paperwork, not results — the organiser publishes those.
                </p>

                {nextInSeries ? (
                  <Link
                    href={`/tournaments/${nextInSeries.slug}`}
                    className="border-power-orange/30 group mt-5 flex items-center justify-between gap-3 rounded-xl border bg-orange-50/50 p-4 transition hover:bg-orange-50"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        Next edition
                      </p>
                      <p className="group-hover:text-power-orange mt-0.5 truncate text-sm font-bold text-slate-800">
                        {nextInSeries.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatShortDate(nextInSeries.startDate)}
                        {nextInSeries.city ? ` · ${nextInSeries.city}` : ""}
                      </p>
                    </div>
                    <ArrowRight className="text-power-orange h-4 w-4 shrink-0" />
                  </Link>
                ) : (
                  <Link
                    href={`/tournaments/sport/${edition.sportSlug}`}
                    className="text-power-orange mt-4 inline-flex items-center gap-1.5 text-sm font-bold transition hover:text-orange-600"
                  >
                    See upcoming {SPORT_LABEL[edition.sportSlug] ?? edition.sportSlug} tournaments
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Fact sheet: the thing a parent actually came for ── */}
        {factSheet ? (
          <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
            <h2 className="font-title text-deep-slate text-xl font-bold">
              {finished ? "Entry details (archived)" : "Entry details"}
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              {finished
                ? "The fact sheet as it was published for this event — entries have closed."
                : DOCUMENT_META.factSheet.hint}
            </p>
            <a
              href={factSheet.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-power-orange mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
            >
              <FileText className="h-4 w-4" />
              Open the fact sheet
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </a>
            {edition.detailUrl && (
              // Federation document links are often time-limited signed URLs, so
              // the tournament's own page is the link that still works later.
              <p className="mt-3 text-xs text-slate-400">
                Link not working?{" "}
                <a
                  href={edition.detailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-power-orange font-semibold text-slate-500 underline"
                >
                  Open this tournament on the federation site
                </a>{" "}
                for the current copy.
              </p>
            )}
          </section>
        ) : finished ? null : (
          // Only meaningful while the event is still ahead — "entry details go
          // up a few weeks before it starts" is nonsense on an event that ran
          // last month, and the finished panel above already explains the page.
          <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
              <div>
                <h2 className="font-title text-deep-slate text-lg font-bold">
                  No fact sheet published yet
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {federation?.acronym ?? "The federation"} hasn&apos;t posted entry details for
                  this event yet. They usually go up a few weeks before it starts.
                </p>
                {edition.detailUrl && (
                  <a
                    href={edition.detailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-power-orange mt-3 inline-flex items-center gap-1.5 text-sm font-semibold"
                  >
                    Check the federation&apos;s page
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── At a glance ── */}
        <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
          <h2 className="font-title text-deep-slate text-xl font-bold">At a glance</h2>
          <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            {facts.map((fact) => (
              <div key={fact.label} className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-slate-400">{fact.icon}</span>
                <div className="min-w-0">
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    {fact.label}
                  </dt>
                  <dd className="text-sm font-semibold text-slate-700">{fact.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Remaining documents ── */}
        {otherDocuments.length > 0 && (
          <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
            <h2 className="font-title text-deep-slate text-xl font-bold">Documents</h2>
            {/* Grouped by kind so the explanation is stated once, instead of
                repeating under every row of the same type. */}
            {groupDocumentsByKind(otherDocuments).map((group) => (
              <div key={group.kind} className="mt-5 first:mt-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {group.items.length > 1
                    ? `${DOCUMENT_META[group.kind].label}s`
                    : DOCUMENT_META[group.kind].label}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{DOCUMENT_META[group.kind].hint}</p>
                <ul className="mt-2 divide-y divide-slate-100">
                  {group.items.map((doc) => (
                    <li key={doc.url}>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 py-2.5 transition hover:bg-slate-50/60"
                      >
                        <ListChecks className="h-4 w-4 shrink-0 text-slate-400" />
                        <p className="group-hover:text-power-orange min-w-0 flex-1 text-sm font-semibold text-slate-700">
                          {doc.displayLabel}
                        </p>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {/* ── Parent experiences ── */}
        {edition._id && (
          <section>
            <ParentExperiencesBand
              kind="TOURNAMENT_EDITION"
              refId={edition._id}
              name={edition.name}
              slug={edition.slug}
            />
          </section>
        )}

        {/* ── Other events nearby ── */}
        {related.length > 0 && (
          <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
            <h2 className="font-title text-deep-slate text-xl font-bold">
              {/* The list tops up sport-wide when the city runs dry, so only
                  claim the city when every row actually is in it. */}
              {edition.city && related.every((r) => r.city === edition.city)
                ? `More tournaments in ${edition.city}`
                : "Other upcoming tournaments"}
            </h2>
            <ul className="mt-4 divide-y divide-slate-100">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/tournaments/${r.slug}`}
                    className="group flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="group-hover:text-power-orange truncate text-sm font-semibold text-slate-700">
                        {r.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatShortDate(r.startDate)}
                        {r.ageGroups?.length ? ` · ${r.ageGroups.join(", ")}` : ""}
                      </p>
                    </div>
                    <ArrowRight className="group-hover:text-power-orange h-4 w-4 shrink-0 text-slate-300 transition" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Provenance ── */}
        <p className="px-1 text-xs text-slate-400">
          Details published by{" "}
          {federation ? `${federation.name} (${federation.acronym})` : "the federation"}
          {edition.lastCheckedAt && <> · last checked {formatShortDate(edition.lastCheckedAt)}</>}.
          {edition.detailUrl && (
            <>
              {" "}
              <a
                href={edition.detailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-power-orange font-semibold underline"
              >
                View the original listing
              </a>
              .
            </>
          )}
        </p>
      </div>
    </main>
  );
}
