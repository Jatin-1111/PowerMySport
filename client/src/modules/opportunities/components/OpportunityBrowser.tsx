"use client";

import { SPORT_LABEL } from "@/modules/pathway/config/tournamentDisplay";
import { MessageCircle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useOpportunityProfile } from "../hooks/useOpportunityProfile";
import { GROUP_THRESHOLD, TRACKS, askUsHref } from "../config/tracks";
import type { Opportunity, OpportunityTrack } from "../services/opportunities";
import { formatDay } from "../utils/format";
import { VERDICT_ORDER, checkOpportunity, hasProfile, type Verdict } from "../utils/match";
import { OpportunityCard } from "./OpportunityCard";
import { ProfileFields } from "./ProfileFields";

// ─── The list on /admissions and /scholarships ───────────────────────────
//
// Three things the plain server list could not do:
//  - it adapts to how much there is. A handful of entries is shown as one list
//    with the category on each card, not as five headed sections that are
//    mostly empty;
//  - once a parent says who the child is, it marks each entry as fitting, worth
//    checking or not a match, and puts the ones that fit first;
//  - when the list is short or comes up empty it says so, and offers a person.
//
// The server still renders every card (this is a client component, not a
// client-only one), so the page reads fully with no JavaScript and to a crawler.

export function OpportunityBrowser({
  track,
  items,
  sports,
  categories,
  today,
  selectedSport,
}: {
  track: OpportunityTrack;
  items: Opportunity[];
  /** Sport-specific slugs present in this track, for the sport filter. */
  sports: string[];
  /** The track's categories in display order. */
  categories: string[];
  /** India's date from the server, so every "days left" agrees. */
  today: string;
  selectedSport?: string | undefined;
}) {
  const config = TRACKS[track];
  const { profile, clear } = useOpportunityProfile();
  const known = hasProfile(profile);
  const [hideMismatches, setHideMismatches] = useState(false);
  const [category, setCategory] = useState<string | null>(null);

  const verdicts = useMemo(() => {
    const map = new Map<string, Verdict | null>();
    for (const item of items) map.set(item.slug, checkOpportunity(item, profile).verdict);
    return map;
  }, [items, profile]);

  const counts = useMemo(() => {
    const tally = { fits: 0, check: 0, no: 0 };
    for (const verdict of verdicts.values()) if (verdict) tally[verdict] += 1;
    return tally;
  }, [verdicts]);

  const flat = items.length < GROUP_THRESHOLD;
  const presentCategories = categories.filter((name) =>
    items.some((item) => item.category === name)
  );

  const shown = useMemo(() => {
    const kept = items.filter((item) => {
      if (category && item.category !== category) return false;
      if (hideMismatches && verdicts.get(item.slug) === "no") return false;
      return true;
    });
    if (!known) return kept;
    // Stable: ties keep the server's order (open windows first).
    return kept
      .map((item, index) => ({ item, index }))
      .sort(
        (a, b) =>
          VERDICT_ORDER[verdicts.get(a.item.slug) ?? "none"] -
            VERDICT_ORDER[verdicts.get(b.item.slug) ?? "none"] || a.index - b.index
      )
      .map(({ item }) => item);
  }, [items, category, hideMismatches, known, verdicts]);

  const latestCheck = items
    .map((item) => item.lastVerifiedOn)
    .filter((day): day is string => Boolean(day))
    .sort()
    .at(-1);
  const noun = items.length === 1 ? "entry" : "entries";
  const askLabel = selectedSport ? (SPORT_LABEL[selectedSport] ?? selectedSport) : undefined;

  const card = (item: Opportunity, withCategory: boolean) => (
    <li key={item.slug}>
      <OpportunityCard
        opportunity={item}
        today={today}
        categoryLabel={withCategory ? config.categories[item.category]?.label : undefined}
        verdict={known ? (verdicts.get(item.slug) ?? null) : null}
      />
    </li>
  );

  return (
    <div className="space-y-8">
      {items.length > 0 && (
        <section
          aria-labelledby="find-fit-heading"
          className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
            <div>
              <h2 id="find-fit-heading" className="font-title text-base font-bold text-slate-900">
                Find what fits your child
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">
                Tell us any of these and we mark each entry. Kept on this device only.
              </p>
            </div>
            {known && (
              <button
                type="button"
                onClick={clear}
                className="btn-motion text-power-orange-solid focus-visible:ring-power-orange-solid inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2"
              >
                <RotateCcw aria-hidden className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>

          <ProfileFields sports={sports} />

          {known && (
            <div
              role="status"
              className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-slate-100 pt-3 text-sm"
            >
              <p className="text-slate-700">
                <span className="font-semibold text-emerald-800">{counts.fits} fit</span>
                {" · "}
                <span className="font-semibold text-amber-900">{counts.check} to check</span>
                {" · "}
                <span className="font-semibold text-slate-700">{counts.no} not a match</span>
              </p>
              {counts.no > 0 && (
                <label className="flex cursor-pointer items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={hideMismatches}
                    onChange={(e) => setHideMismatches(e.target.checked)}
                    className="accent-power-orange-solid h-4 w-4"
                  />
                  Hide the ones that do not match
                </label>
              )}
            </div>
          )}
        </section>
      )}

      {items.length > 0 && (
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-800">
            {items.length} {noun} listed so far
          </span>
          {latestCheck ? `, last checked ${formatDay(latestCheck)}` : ""}.
          {flat && " We add more as each one is checked against its official source."}
        </p>
      )}

      {sports.length > 1 && (
        <nav aria-label="Filter by sport" className="flex flex-wrap gap-2">
          {[undefined, ...sports].map((slug) => {
            const selected = slug === selectedSport;
            return (
              <Link
                key={slug ?? "all"}
                href={slug ? `${config.path}?sport=${slug}` : config.path}
                aria-current={selected ? "true" : undefined}
                className={`inline-flex min-h-9 items-center rounded-md border px-3 text-sm font-semibold transition-colors ${
                  selected
                    ? "bg-power-orange-solid border-power-orange-solid text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:text-orange-700"
                }`}
              >
                {slug ? (SPORT_LABEL[slug] ?? slug) : "All sports"}
              </Link>
            );
          })}
        </nav>
      )}

      {flat && presentCategories.length > 1 && (
        <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-2">
          {[null, ...presentCategories].map((name) => {
            const active = name === category;
            const label = name ? config.categories[name]?.label : "All types";
            return (
              <button
                key={name ?? "all"}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(name)}
                className={`btn-motion min-h-9 rounded-md border px-3 text-sm font-semibold ${
                  active
                    ? "bg-power-orange-solid border-power-orange-solid text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:text-orange-700"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {shown.length > 0 ? (
        flat ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((item) => card(item, presentCategories.length > 1))}
          </ul>
        ) : (
          categories
            .map((name) => ({
              name,
              meta: config.categories[name],
              entries: shown.filter((item) => item.category === name),
            }))
            .filter((section) => section.meta && section.entries.length > 0)
            .map((section) => (
              <section key={section.name} aria-labelledby={`section-${section.name}`}>
                <h2
                  id={`section-${section.name}`}
                  className="font-title text-xl font-extrabold text-slate-900"
                >
                  {section.meta!.label}
                </h2>
                <p className="mt-1 text-sm text-slate-600">{section.meta!.blurb}</p>
                <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {section.entries.map((item) => card(item, false))}
                </ul>
              </section>
            ))
        )
      ) : items.length > 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-700">
          Nothing here matches that. Clear the filters or ask us below.
        </p>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="text-sm font-semibold text-slate-800">
            We are checking these against their official sources.
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Each one goes up once someone has verified it, so nothing here sends you after a
            deadline that has moved.
          </p>
        </div>
      )}

      {(flat || items.length === 0 || shown.length === 0) && (
        <aside className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="max-w-xl">
            <h2 className="font-title text-base font-bold text-slate-900">
              Not listed here? Tell us what you are looking for.
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Ask on WhatsApp and a person will tell you what we know. What you ask for helps us
              decide which to check next.
            </p>
          </div>
          <a
            href={askUsHref(track, askLabel)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-motion focus-visible:ring-power-orange-solid inline-flex items-center gap-2 rounded-md bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <MessageCircle aria-hidden className="h-4 w-4" />
            Ask on WhatsApp
          </a>
        </aside>
      )}
    </div>
  );
}
