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
import type {
  EditionDocument,
  TournamentEditionDetail,
} from "@/modules/sports/services/pathway";
import { CAL_TZ, formatLocation, levelColor } from "../../federations/[slug]/editionUtils";
import { AddToCalendarButton } from "../../federations/[slug]/AddToCalendarButton";
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

const DOCUMENT_META: Record<
  EditionDocument["kind"],
  { label: string; hint: string }
> = {
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
  if (!detail) return { title: "Tournament — PowerMySport" };

  const { edition } = detail;
  const title = edition.officialName || edition.name;
  const where = formatLocation(edition.venue, edition.city);
  const description = [
    `${title} starts ${formatShortDate(edition.startDate)}`,
    where ? `at ${where}` : null,
    edition.ageGroups?.length ? `for ${edition.ageGroups.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 155);

  return {
    title: `${edition.name} — ${formatShortDate(edition.startDate)} | PowerMySport`,
    description,
    alternates: { canonical: `/tournaments/${edition.slug}` },
    openGraph: {
      title,
      description,
      url: `https://powermysport.com/tournaments/${edition.slug}`,
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

  const { edition, federation, related } = detail;
  const location = formatLocation(edition.venue, edition.city);
  const lc = edition.level ? levelColor(edition.level) : null;
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

  return (
    <main className="min-h-screen">
      {/* ── Hero ── */}
      <div className="bg-deep-slate">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          {federation && (
            <div className="border-b border-white/[0.07] pt-5 pb-4">
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

          <div className="pt-5 pb-8">
            <AddToCalendarButton edition={edition} variant="hero" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {/* ── Fact sheet: the thing a parent actually came for ── */}
        {factSheet ? (
          <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
            <h2 className="font-title text-xl font-bold text-deep-slate">Entry details</h2>
            <p className="mt-1.5 text-sm text-slate-500">{DOCUMENT_META.factSheet.hint}</p>
            <a
              href={factSheet.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-power-orange px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
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
                  className="font-semibold text-slate-500 underline hover:text-power-orange"
                >
                  Open this tournament on the federation site
                </a>{" "}
                for the current copy.
              </p>
            )}
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
              <div>
                <h2 className="font-title text-lg font-bold text-deep-slate">
                  No fact sheet published yet
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {federation?.acronym ?? "The federation"} hasn&apos;t posted entry details for this
                  event yet. They usually go up a few weeks before it starts.
                </p>
                {edition.detailUrl && (
                  <a
                    href={edition.detailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-power-orange"
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
          <h2 className="font-title text-xl font-bold text-deep-slate">At a glance</h2>
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
            <h2 className="font-title text-xl font-bold text-deep-slate">Documents</h2>
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
                        <p className="min-w-0 flex-1 text-sm font-semibold text-slate-700 group-hover:text-power-orange">
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

        {/* ── Other events nearby ── */}
        {related.length > 0 && (
          <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
            <h2 className="font-title text-xl font-bold text-deep-slate">
              {edition.city ? `More tournaments in ${edition.city}` : "Other upcoming tournaments"}
            </h2>
            <ul className="mt-4 divide-y divide-slate-100">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/tournaments/${r.slug}`}
                    className="group flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-700 group-hover:text-power-orange">
                        {r.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatShortDate(r.startDate)}
                        {r.ageGroups?.length ? ` · ${r.ageGroups.join(", ")}` : ""}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-power-orange" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Provenance ── */}
        <p className="px-1 text-xs text-slate-400">
          Details published by {federation ? `${federation.name} (${federation.acronym})` : "the federation"}
          {edition.lastCheckedAt && <> · last checked {formatShortDate(edition.lastCheckedAt)}</>}.
          {edition.detailUrl && (
            <>
              {" "}
              <a
                href={edition.detailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline hover:text-power-orange"
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
