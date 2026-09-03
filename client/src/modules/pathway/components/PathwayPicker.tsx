"use client";

// ─── The sport picker ────────────────────────────────────────────────────────
//
// The one thing `/roadmap` exists to do: get a parent out of the index and into
// the part of a pathway that is about their child.
//
// ── Why it is more than a list of links ──
//
// It was a list of links. Each one opened its sport at stage one, which is the
// right stage for a parent who has not started and the wrong stage for everyone
// else — the eleven-year-old's parent landed four stages early and had to work
// out, from a rail of unfamiliar names, where they actually belonged. That work
// happens at the exact moment a visitor is cheapest to lose.
//
// So when the child's age is known, each tile points at the stage that is about
// them rather than at stage one.
//
// It is not ASKED for here. There was an age field at the top of this page, and
// it was the wrong place for it: a form field is a toll gate on the one screen
// whose entire job is "pick a sport", and it charged that toll before the page
// had shown a parent anything worth paying for. The reader asks instead, in the
// middle of content that has already earned the question, and the answer is
// remembered — so a parent coming back to the index gets the recommendations
// without this page ever having asked.
//
// ── Why it is built for fifty sports, not ten ──
//
// Ten pathways are published; the plan is many more. Every decision below is
// what it is because the same component has to work at fifty:
//
//   · NEVER show the catalogue as cards. This is the load-bearing one. A tile is
//     a rich object — a name, a stage count, the child's own stage, a control
//     that opens the rest — and fifty of those is not a picker, it is a car
//     park. Compacting the card does not fix it; fifty of anything laid out in a
//     grid is a wall. So the default view is `BROWSE_TILES` sports in curated
//     order, a search result is capped at `RESULT_TILES`, and the complete list
//     lives at the foot as an alphabetical index of plain links — dense,
//     skimmable, and the right shape for a directory. Rich cards are for the few
//     sports a parent is choosing between; a directory is for the rest.
//
//   · FIND, don't scan. The primary interaction is not "look down the list", it
//     is "type the name". Search is therefore the first and largest control —
//     and it renders at two sports as readily as at fifty, because the box is
//     also how a visitor learns that this page is a catalogue rather than the
//     short list it currently looks like. It matches aliases, so "ping pong" and
//     "soccer" find the sport they mean, and Enter opens the top match at the
//     child's stage without touching the list at all.
//
//   · GROUP the rest. A flat fifty is a wall. The group filter appears only once
//     there are enough sports to need it (`GROUP_FILTER_FROM`), so today's page
//     is not cluttered by a control that answers a question nobody has yet.
//
//   · PROGRESSIVE stages. The tile shows the ONE stage that matters (the child's,
//     once an age is known) and reveals the rest on request, one sport at a time.
//
//   · NO reordering by age. It was sorted so age-matched sports came first,
//     which reads well at three sports and does nothing at fifty — nearly every
//     sport has a stage covering a twelve-year-old, so the sort churns the grid
//     and separates nothing. Curated order is stable and learnable instead.
//
//   · NO layout animation. Animating fifty tiles into new positions on every
//     keystroke is the kind of motion that makes a fast filter feel slow.
//
// Everything renders on the server too. Search and filtering start empty, and
// the A–Z index is a real <details> rather than a JavaScript toggle, so the HTML
// a crawler reads still contains every published sport as a real link — capping
// the TILES does not cap the LINKS.

import { ChevronDown, MapPin, Search, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { findStageForAge } from "../utils/ageRange";
import { useChildAge } from "../utils/childAge";
import type { PathwayIndexEntry } from "../services/fetchGuide";
import { filterSports, groupCounts, indexSports } from "../utils/pickerFilter";
import type { SportGroup } from "../data/sports";

/** Below this many sports, the group filter is noise. */
const GROUP_FILTER_FROM = 12;

/**
 * Where the tiles start packing tighter.
 *
 * Not a threshold for the search box. Search used to be hidden below this count,
 * on the reasoning that two sports do not need finding — which is true and beside
 * the point: the box is how a visitor learns this page is a catalogue rather than
 * the two-sport list it currently looks like. It renders always.
 */
const DENSE_FROM = 8;

/**
 * How many sports are shown as tiles before the parent has narrowed anything.
 *
 * The number that matters most in this file. A tile is a rich object — a name, a
 * stage count, the child's own stage, a control that opens the rest — and fifty
 * of them is not a picker, it is a car park. So the default view is a handful in
 * curated order and the catalogue lives behind search, a group, or the A–Z index
 * at the foot. Eight fills two rows on a laptop and four on a phone.
 */
const BROWSE_TILES = 8;

/**
 * The cap on a search or group result.
 *
 * Typing one letter can match thirty sports, and thirty tiles is the same car
 * park arrived at from a different direction. Past this the page says how many
 * more there are and asks for another letter, which is cheaper for the parent
 * than a scroll.
 */
const RESULT_TILES = 12;

/**
 * One colour per stage position, matching the reader's rail so a stage keeps its
 * identity across the two pages.
 */
const STAGE_COLORS = [
  "#16a34a",
  "#ea580c",
  "#d97706",
  "#7c3aed",
  "#2563eb",
  "#0d9488",
  "#db2777",
  "#0891b2",
  "#65a30d",
];

const colorFor = (index: number) => STAGE_COLORS[index % STAGE_COLORS.length] as string;

/** `/roadmap/tennis?stage=compete` — the reader renders that stage server-side. */
const stageHref = (slug: string, key?: string) =>
  key ? `/roadmap/${slug}?stage=${encodeURIComponent(key)}` : `/roadmap/${slug}`;

// ─── One sport ───────────────────────────────────────────────────────────────

function SportTile({
  entry,
  age,
  expanded,
  onToggle,
}: {
  entry: PathwayIndexEntry;
  age: number | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const panelId = `pathway-stages-${entry.sportSlug}`;
  const matchIndex =
    age === null || entry.stages.length === 0 ? -1 : findStageForAge(entry.stages, age);
  const match = matchIndex >= 0 ? entry.stages[matchIndex] : undefined;

  return (
    // `isolate`, so the stretched link below covers this tile and stops at its
    // edge rather than sitting over the neighbouring one.
    <div className="premium-shadow hover:border-power-orange/40 relative isolate flex h-full flex-col rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur-sm transition hover:shadow-lg">
      {/* The whole tile is the target, but only one element is the link: an
          anchor with a stretched `::after` rather than a card-wide anchor with
          controls nested inside it. Nesting a button inside an anchor is invalid
          HTML and unusable with a keyboard, and it is exactly what a card with a
          secondary "show stages" toggle tempts you into. */}
      <Link
        href={stageHref(entry.sportSlug, match?.key)}
        className="font-title hover:text-power-orange focus-visible:outline-power-orange text-[17px] leading-tight font-bold text-slate-900 transition after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {entry.sportName}
      </Link>

      <p className="mt-0.5 text-[12.5px] font-semibold text-slate-400">
        {entry.stageCount} stage{entry.stageCount === 1 ? "" : "s"}
      </p>

      {/* ── The one stage that matters ──
          At fifty sports a tile cannot carry six stage chips, and it does not
          need to: once the age is known there is exactly one stage this parent
          should open, and the tile links straight to it. */}
      {match && (
        <p className="mt-2 inline-flex w-fit items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[12px] font-bold text-amber-900 ring-1 ring-amber-200">
          <MapPin aria-hidden className="h-3 w-3 shrink-0" />
          Stage {matchIndex + 1} · {match.name}
        </p>
      )}

      {/* Pushes the toggle to the bottom so tiles of different heights line up. */}
      <div className="flex-1" />

      {entry.stages.length > 0 && (
        <>
          {/* `relative z-10`, or the stretched link above would swallow it. */}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={panelId}
            className="focus-visible:outline-power-orange relative z-10 mt-2.5 inline-flex w-fit items-center gap-1 rounded-lg px-1.5 py-1 text-[12px] font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {expanded ? "Hide stages" : "All stages"}
            <ChevronDown
              aria-hidden
              className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>

          {/* Rendered, not animated open. An expanding height is content that
              only exists once a frame loop has run, and in a throttled tab it
              stays at zero with the answer inside it. */}
          <div id={panelId} hidden={!expanded} className="relative z-10">
            <ul className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5">
              {entry.stages.map((stage, i) => (
                <li key={stage.key}>
                  <Link
                    href={stageHref(entry.sportSlug, stage.key)}
                    className={`focus-visible:outline-power-orange inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[12px] font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
                      i === matchIndex
                        ? "border-amber-300 bg-amber-50 text-amber-900"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black text-white"
                      style={{ background: colorFor(i) }}
                    >
                      {i + 1}
                    </span>
                    {stage.name}
                    <span className="font-semibold text-slate-400">{stage.ageRange}</span>
                    {i === matchIndex && (
                      <span className="sr-only">— where a {age}-year-old starts</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

// ─── The picker ──────────────────────────────────────────────────────────────

export function PathwayPicker({ entries }: { entries: PathwayIndexEntry[] }) {
  // `null` on the server and on the first client render, then whatever the
  // parent last told us. Writing it is what the reader reads, so an age typed
  // here also marks "you are here" on every pathway opened afterwards.
  const age = useChildAge();

  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<SportGroup | "All">("All");
  // One sport's stages open at a time. Fifty tiles all expanded is the wall this
  // component exists to avoid, and a parent comparing two sports opens the
  // second one straight after the first anyway.
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const searchId = useId();
  const router = useRouter();

  const dense = entries.length >= DENSE_FROM;

  // Ordering, grouping and matching all live in `pickerFilter` — pure functions
  // the tests can run over fifty synthetic sports, which is the scale this page
  // is built for and cannot yet be seen at.
  const sports = useMemo(() => indexSports(entries), [entries]);
  const groups = useMemo(() => groupCounts(sports), [sports]);

  // ── A filter that cannot divide the list does not belong on the page ──
  //
  // Groups come from a hand-maintained registry, and sports get published faster
  // than anyone classifies them. Left alone, that produces a filter row reading
  // "All 54 · Other 44 · Team 5 · Racquet 3" — four controls where one of them
  // is the list again. So the row only renders when the largest group is a real
  // minority of the catalogue; until the registry catches up, search and the A–Z
  // index carry the page on their own.
  const largestGroup = groups[0]?.[1] ?? 0;
  const showGroups =
    entries.length >= GROUP_FILTER_FROM &&
    groups.length >= 3 &&
    largestGroup / entries.length < 0.6;
  const visible = useMemo(() => filterSports(sports, { group, query }), [sports, group, query]);

  const needle = query.trim().toLowerCase();

  if (entries.length === 0) {
    return (
      <p className="mx-auto mt-4 max-w-xl text-center text-sm text-slate-600 sm:text-base">
        No pathways are published yet. We&apos;re building them with coaches and experienced
        parents, one sport at a time — check back shortly.
      </p>
    );
  }

  const narrowed = needle.length > 0 || group !== "All";
  const cap = narrowed ? RESULT_TILES : BROWSE_TILES;
  const tiles = visible.slice(0, cap);
  const beyondCap = visible.length - tiles.length;
  const topMatch = visible[0];

  /** Every sport, alphabetically, for the dense index at the foot. */
  const alphabetical = [...entries].sort((a, b) => a.sportName.localeCompare(b.sportName));

  return (
    <>
      {/* ── Controls ──
          Sticky ONLY once there is enough below it to scroll past. A bar that
          pins itself over a two-sport list is a frame around nothing: it costs a
          strip of every screen and never once saves the reader a scroll back.
          `top-16` is the site header's own height. */}
      <div
        className={`z-20 mx-auto mt-9 max-w-2xl px-1 py-1 ${
          dense
            ? "premium-shadow sticky top-16 rounded-2xl border border-white/70 bg-white/85 px-3 py-3 backdrop-blur-md"
            : ""
        }`}
      >
        {/* Search leads, and it is the only control here by default. "Which
            sport?" is answered by typing, not by looking — a parent arrives at
            this page already knowing the word. */}
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            // Enter opens the top match. The list below is the slow path; a
            // parent who typed "badmin" has already chosen.
            if (topMatch) {
              const matchIndex = age === null ? -1 : findStageForAge(topMatch.stages, age);
              router.push(
                stageHref(
                  topMatch.sportSlug,
                  matchIndex >= 0 ? topMatch.stages[matchIndex]?.key : undefined
                )
              );
            }
          }}
          className="mx-auto max-w-lg"
        >
          <label htmlFor={searchId} className="sr-only">
            Search sports
          </label>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3.5 h-4.5 w-4.5 -translate-y-1/2 text-slate-400"
            />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${entries.length} sport${entries.length === 1 ? "" : "s"}`}
              className="focus:border-power-orange w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-9 pl-10 text-[15px] font-semibold text-slate-800 shadow-sm placeholder:font-normal placeholder:text-slate-400 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="focus-visible:outline-power-orange absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <X aria-hidden className="h-4 w-4" />
                <span className="sr-only">Clear search</span>
              </button>
            )}
          </div>
          {needle && topMatch && (
            <p className="mt-1.5 text-center text-[12px] text-slate-500">
              Press Enter to open{" "}
              <span className="font-bold text-slate-700">{topMatch.sportName}</span>
            </p>
          )}
        </form>

        {showGroups && (
          <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
            {([["All", entries.length], ...groups] as Array<[SportGroup | "All", number]>).map(
              ([name, count]) => (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => setGroup(name)}
                    aria-pressed={group === name}
                    className={`focus-visible:outline-power-orange rounded-full px-3 py-1.5 text-[12.5px] font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
                      group === name
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                    }`}
                  >
                    {name}{" "}
                    <span className={group === name ? "text-white/60" : "text-slate-400"}>
                      {count}
                    </span>
                  </button>
                </li>
              )
            )}
          </ul>
        )}
      </div>

      {/* What the controls did, for a screen reader that cannot see the grid
          shrink. Polite, so it waits for a pause in typing rather than
          interrupting every keystroke. */}
      <p aria-live="polite" className="sr-only">
        {visible.length} of {entries.length} sports match
      </p>

      {/* Only when there is something to say. The age is no longer asked for
          here — it is asked once inside a pathway and remembered — so this line
          appears for a parent who has already answered it somewhere else, and
          nothing is shown to one who has not. */}
      {age !== null && (
        <p className="mt-3 text-center text-[12.5px] text-slate-500">
          Showing where a {age}-year-old starts in each sport.
        </p>
      )}

      {tiles.length > 0 ? (
        // ── Density follows the catalogue ──
        // One column on a phone is the comfortable read at three sports and a
        // long scroll at fifty. Past the point where the search box appears, the
        // tiles go two-up on mobile and four-up on a desktop: the same tile,
        // packed tighter, because by then finding beats browsing.
        <ul
          className={`mt-4 grid gap-3 ${
            dense
              ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {tiles.map((entry) => (
            <li key={entry.sportSlug}>
              <SportTile
                entry={entry}
                age={age}
                expanded={openSlug === entry.sportSlug}
                onToggle={() => setOpenSlug(openSlug === entry.sportSlug ? null : entry.sportSlug)}
              />
            </li>
          ))}
        </ul>
      ) : (
        // A search that finds nothing is the clearest signal this page ever gets
        // that a parent knows exactly what they want and we do not have it. It
        // ends in a route to a person, not an apology.
        <div className="premium-shadow mx-auto mt-6 max-w-md rounded-2xl border border-white/70 bg-white/80 p-6 text-center backdrop-blur-sm">
          <p className="text-[15px] font-bold text-slate-900">
            No pathway for {needle ? `"${query.trim()}"` : "that group"} yet
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">
            We write them with coaches and experienced parents, one sport at a time. Tell us about
            your child and we&apos;ll point you at the right people for their sport in the meantime.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link
              href="/assessment"
              className="bg-power-orange inline-flex items-center rounded-xl px-3.5 py-2 text-[13px] font-bold text-white transition hover:bg-orange-600"
            >
              Get a plan for their sport
            </Link>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setGroup("All");
              }}
              className="inline-flex items-center rounded-xl border border-slate-300 px-3.5 py-2 text-[13px] font-bold text-slate-700 transition hover:border-slate-400"
            >
              Show all sports
            </button>
          </div>
        </div>
      )}

      {/* ── What is not on screen ──
          Said plainly rather than left to a scrollbar. "Eight of fifty-four" is
          the difference between a page that looks short and a page that looks
          incomplete. */}
      {beyondCap > 0 && (
        <p className="mt-3 text-center text-[12.5px] text-slate-500">
          {narrowed ? (
            <>
              {beyondCap} more match{beyondCap === 1 ? "" : "es"} — keep typing to narrow it down.
            </>
          ) : (
            <>
              Showing {tiles.length} of {entries.length} sports. Search above, or open the full list
              below.
            </>
          )}
        </p>
      )}

      {/* ── The full catalogue ──
          Every published sport, as a plain link in an alphabetical index rather
          than as a fifty-first card. This is what the tiles above deliberately
          do not do: a rich card is the right shape for the few sports a parent
          is choosing between, and the wrong shape for a directory.

          A real <details>: the whole list is in the HTML whether it is open or
          not, so a crawler indexes every pathway and a parent without
          JavaScript can still open it. */}
      {entries.length > BROWSE_TILES && (
        <details className="group mt-6 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 backdrop-blur-sm">
          <summary className="flex cursor-pointer list-none items-center justify-center gap-1.5 text-[13px] font-bold text-slate-600 transition hover:text-slate-900 [&::-webkit-details-marker]:hidden">
            All {entries.length} sports, A–Z
            <ChevronDown
              aria-hidden
              className="h-4 w-4 transition-transform group-open:rotate-180"
            />
          </summary>
          <ul className="mt-3 columns-2 gap-x-6 border-t border-slate-100 pt-3 sm:columns-3 lg:columns-4">
            {alphabetical.map((entry) => (
              <li key={entry.sportSlug} className="break-inside-avoid">
                <Link
                  href={`/roadmap/${entry.sportSlug}`}
                  className="hover:text-power-orange block truncate py-1 text-[13.5px] font-semibold text-slate-600 transition"
                >
                  {entry.sportName}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
        <Sparkles aria-hidden className="h-3.5 w-3.5" />
        More sports are being written with coaches and experienced parents, one at a time.
      </p>
    </>
  );
}
