import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Trophy } from "lucide-react";
import type { TournamentEdition } from "@/modules/pathway/services/pathway";
import { CAL_TZ, formatLocation, levelColor } from "../../../federations/[slug]/editionUtils";
import { SPORT_LABEL } from "../../../federations/[slug]/federationShared";

/**
 * The category-level counterpart to /tournaments/[slug]. That page wins
 * hundreds of individual long-tail searches ("CS7 Delhi") but nothing ranks
 * for the broader "chess tournaments in India" query these editions are all
 * an answer to — this page is that answer, and it fans out into the dated
 * pages via the card grid below.
 */

const EDITIONS_PER_PAGE = 24;
const LIST_REVALIDATE_SECONDS = 300;

interface EditionsListResponse {
  editions: TournamentEdition[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

async function fetchEditions(
  sportSlug: string,
  { page, upcoming }: { page: number; upcoming: boolean }
): Promise<EditionsListResponse | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  const qs = new URLSearchParams({
    sport: sportSlug,
    page: String(page),
    limit: String(EDITIONS_PER_PAGE),
    upcoming: String(upcoming),
  });
  try {
    const res = await fetch(`${apiBase}/tournament-editions?${qs.toString()}`, {
      next: { revalidate: LIST_REVALIDATE_SECONDS, tags: ["tournament-editions"] },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.success ? (body.data as EditionsListResponse) : null;
  } catch {
    return null;
  }
}

function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: CAL_TZ,
  });
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sport: string }>;
}): Promise<Metadata> {
  const { sport } = await params;
  const sportLabel = SPORT_LABEL[sport];
  if (!sportLabel) return { title: "Tournaments" };

  const title = `${sportLabel} Tournaments in India — Upcoming Dates & Fact Sheets`;
  const description = `Browse upcoming ${sportLabel} tournaments across India — dates, venues, age groups and entry fact sheets, updated as federations publish them.`;

  return {
    title,
    description,
    alternates: { canonical: `/tournaments/sport/${sport}` },
    openGraph: {
      title,
      description,
      url: `/tournaments/sport/${sport}`,
      type: "website",
      siteName: "PowerMySport",
    },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SportTournamentsHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ sport: string }>;
  searchParams: Promise<{ page?: string; when?: string }>;
}) {
  const { sport } = await params;
  const sportLabel = SPORT_LABEL[sport];
  if (!sportLabel) notFound();

  const { page: pageParam, when } = await searchParams;
  const upcoming = when !== "past";
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);

  const result = await fetchEditions(sport, { page, upcoming });
  const editions = result?.editions ?? [];
  const totalPages = result?.totalPages ?? 1;
  const total = result?.total ?? 0;

  return (
    <>
      <JsonLd
        data={[
          // No /tournaments index page exists yet, so the trail starts at
          // Home rather than linking a breadcrumb entry to a 404.
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: `${sportLabel} Tournaments`, path: `/tournaments/sport/${sport}` },
          ]),
          ...(editions.length
            ? [
                itemListJsonLd({
                  name: `${sportLabel} Tournaments in India`,
                  path: `/tournaments/sport/${sport}`,
                  description: `Upcoming ${sportLabel} tournaments across India`,
                  items: editions
                    .filter((e) => e.slug)
                    .map((e) => ({ name: e.name, path: `/tournaments/${e.slug}` })),
                }),
              ]
            : []),
        ]}
      />

      <div className="min-h-screen bg-slate-50">
        <div className="from-power-orange bg-gradient-to-br to-orange-600 px-4 pb-10 pt-14 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h1 className="font-title text-2xl font-extrabold text-white sm:text-3xl">
              {sportLabel} Tournaments in India
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-orange-50">
              {total > 0
                ? `${total} ${upcoming ? "upcoming" : "past"} ${sportLabel.toLowerCase()} tournament${total === 1 ? "" : "s"} — dates, venues and entry fact sheets as federations publish them.`
                : `${upcoming ? "Upcoming" : "Past"} ${sportLabel.toLowerCase()} tournaments across India.`}
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          {/* Upcoming / past toggle */}
          <div className="mb-6 flex gap-2">
            {(["upcoming", "past"] as const).map((tab) => (
              <Link
                key={tab}
                href={`/tournaments/sport/${sport}${tab === "past" ? "?when=past" : ""}`}
                className={`rounded-full border px-4 py-1.5 text-xs font-semibold capitalize transition ${
                  (tab === "upcoming") === upcoming
                    ? "bg-power-orange border-power-orange text-white"
                    : "hover:text-power-orange border-slate-200 bg-white text-slate-600 hover:border-orange-200"
                }`}
              >
                {tab}
              </Link>
            ))}
          </div>

          {editions.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {editions.map((e) => {
                const lc = e.level ? levelColor(e.level) : null;
                const where = formatLocation(e.venue, e.city);
                return (
                  <Link
                    key={e.slug}
                    href={`/tournaments/${e.slug}`}
                    className="hover:border-power-orange/40 group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                  >
                    <div className="from-power-orange h-[3px] w-full bg-gradient-to-r to-amber-400" />
                    <div className="flex flex-col p-4" style={{ minHeight: "150px" }}>
                      {lc && e.level && (
                        <span
                          className={`mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest ${lc.pill}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${lc.dot}`} />
                          {e.level}
                        </span>
                      )}
                      <p className="font-title group-hover:text-power-orange line-clamp-2 flex-1 text-sm font-bold leading-snug text-slate-900">
                        {e.officialName || e.name}
                      </p>
                      <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="h-3 w-3 shrink-0" />
                          <span>{formatShortDate(e.startDate)}</span>
                        </div>
                        {where && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{where}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center">
              <Trophy className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">
                No {upcoming ? "upcoming" : "past"} {sportLabel.toLowerCase()} tournaments listed
                yet
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/tournaments/sport/${sport}?page=${p}${upcoming ? "" : "&when=past"}`}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    p === page
                      ? "bg-power-orange border-power-orange text-white"
                      : "hover:text-power-orange border-slate-200 bg-white text-slate-600 hover:border-orange-200"
                  }`}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
