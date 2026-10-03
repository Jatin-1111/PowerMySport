"use client";

import type { TournamentEdition } from "@/modules/pathway/services/pathway";
import { cn } from "@/utils/cn";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * The next few tournaments as a split-flap departures board.
 *
 * Every character on it is real: a date, an event and an age group read from
 * the federation's calendar. The server renders the settled board, so it reads
 * correctly with no JavaScript and to a crawler; in the browser the tiles flip
 * through a few characters once, left to right, and land on the same text, the
 * way a station board refreshes. Reduced motion skips the flip entirely.
 *
 * Each row is a link to the tournament. The tiles are hidden from assistive
 * technology, which hears the link's plain-text label instead of thirty
 * single letters.
 */

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const FLIP_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const TICK_MS = 45;

/** Column widths, in tiles. The phone layout drops the age column. */
const LAYOUTS = {
  wide: { date: 6, event: 22, age: 6 },
  narrow: { date: 6, event: 17, age: 0 },
} as const;
type Layout = (typeof LAYOUTS)[keyof typeof LAYOUTS];

const width = (layout: Layout) =>
  layout.date + 1 + layout.event + (layout.age ? 1 + layout.age : 0);

// UTC parts and a fixed month list, so the server and the browser can never
// format the same date differently and fail hydration.
function boardDate(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getUTCDate()).padStart(2, "0")} ${MONTHS[date.getUTCMonth()]}`;
}

const boardText = (text: string) =>
  text
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

/** The longest run of whole words that fits, rather than a word cut in half. */
function wholeWords(text: string, size: number): string {
  let fitted = "";
  for (const word of text.split(" ")) {
    const next = fitted ? `${fitted} ${word}` : word;
    if (next.length > size) break;
    fitted = next;
  }
  return fitted;
}

/**
 * "AITA CS7 (Amritsar)" reads as "AITA CS7 AMRITSAR" on a board. When that is
 * too long, the event loses whole words before the city does: the city is what
 * tells five "AITA CS7" rows apart. Only a city too long for what is left gets
 * clipped, the way a station board clips it.
 */
function boardEvent(edition: TournamentEdition, size: number): string {
  const match = edition.name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  const base = boardText(match ? match[1] : edition.name);
  const city = match ? boardText(match[2]) : "";
  const full = city ? `${base} ${city}` : base;
  if (full.length <= size) return full;
  if (!city) return wholeWords(base, size) || base.slice(0, size);
  // The whole event name fits with at least the start of the city after it.
  if (base.length + 4 <= size) return full.slice(0, size);
  const shortened = wholeWords(base, size - city.length - 1);
  return shortened ? `${shortened} ${city}` : wholeWords(base, size) || base.slice(0, size);
}

function boardAge(edition: TournamentEdition): string {
  const ages = (edition.ageGroups ?? []).map((age) =>
    age
      .replace(/^Under-?/i, "U")
      .replace(/^Women$/i, "WMN")
      .toUpperCase()
  );
  if (ages.length === 0) return "";
  return ages.length === 1 ? ages[0] : `${ages[0]} +${ages.length - 1}`;
}

const cell = (text: string, size: number) => text.slice(0, size).padEnd(size, " ");

function boardLine(edition: TournamentEdition, layout: Layout): string {
  const parts = [
    cell(boardDate(edition.startDate), layout.date),
    cell(boardEvent(edition, layout.event), layout.event),
  ];
  if (layout.age) parts.push(cell(boardAge(edition), layout.age));
  return parts.join(" ");
}

function spokenLabel(edition: TournamentEdition): string {
  const date = new Date(edition.startDate);
  // Spelled out: "5 oct" is not reliably expanded by a screen reader.
  const when = `${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]}`;
  const ages = edition.ageGroups?.length ? `, ${edition.ageGroups.join(", ")}` : "";
  return `${edition.name}, ${when}${ages}`;
}

/**
 * True once the element has been at least half on screen. A board far down a
 * page would otherwise flip while nobody is looking and arrive already settled.
 * A browser without IntersectionObserver simply never flips; the board is
 * already showing its settled text.
 */
function useSeen(ref: React.RefObject<HTMLElement | null>): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return seen;
}

/** Flips each character through a few random ones, settling left to right. */
function useFlip(lines: string[], active: boolean): string[] {
  const [shown, setShown] = useState(lines);

  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let tick = 0;
    const lastTick = Math.max(...lines.map((line, row) => settleTick(line.length - 1, row)));
    const timer = window.setInterval(() => {
      tick += 1;
      setShown(
        lines.map((line, row) =>
          [...line]
            .map((char, col) =>
              char === " " || tick >= settleTick(col, row)
                ? char
                : FLIP_CHARS[Math.floor(Math.random() * FLIP_CHARS.length)]
            )
            .join("")
        )
      );
      if (tick >= lastTick) window.clearInterval(timer);
    }, TICK_MS);
    return () => window.clearInterval(timer);
    // `lines` is derived from props on every render; its content is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.join("\n"), active]);

  return shown;
}

const settleTick = (col: number, row: number) => 4 + Math.floor(col * 0.6) + row * 2;

function Board({
  editions,
  layout,
  className,
}: {
  editions: TournamentEdition[];
  layout: Layout;
  className?: string;
}) {
  const cols = width(layout);
  const boardRef = useRef<HTMLDivElement>(null);
  const seen = useSeen(boardRef);
  const lines = useFlip(
    editions.map((edition) => boardLine(edition, layout)),
    seen
  );
  const grid = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };
  // Sized from the board's own width (container query units), so the same
  // board fills a phone and a desktop header without a horizontal scrollbar.
  const font = { fontSize: `calc(92cqw / ${cols})` };

  // Column labels span their columns as ordinary text; one letter per tile
  // read as "D A T E".
  const labels = [
    { text: "Date", start: 1, span: layout.date },
    { text: "Event", start: layout.date + 2, span: layout.event },
    ...(layout.age
      ? [{ text: "Age", start: layout.date + layout.event + 3, span: layout.age }]
      : []),
  ];

  return (
    <div
      ref={boardRef}
      className={cn("@container rounded-lg bg-slate-950 p-2.5 sm:p-4", className)}
    >
      <div
        aria-hidden
        className="mb-2 grid gap-[2px] text-xs font-semibold uppercase tracking-[0.14em] text-slate-400"
        style={grid}
      >
        {labels.map((label) => (
          <span key={label.text} style={{ gridColumn: `${label.start} / span ${label.span}` }}>
            {label.text}
          </span>
        ))}
      </div>
      <ul className="flex flex-col gap-[3px]">
        {editions.map((edition, row) => {
          const tiles = (
            <span aria-hidden className="grid gap-[2px]" style={{ ...grid, ...font }}>
              {[...lines[row]].map((char, col) => (
                <span
                  key={col}
                  className={cn(
                    "relative flex aspect-[3/4] items-center justify-center rounded-[2px] bg-slate-800 font-mono font-bold leading-none",
                    // A hairline across the middle, where the two flaps meet.
                    "after:absolute after:inset-x-0 after:top-1/2 after:h-px after:bg-slate-950",
                    col < layout.date ? "text-amber-300" : "text-white"
                  )}
                >
                  {char}
                </span>
              ))}
            </span>
          );
          return (
            <li key={edition.slug ?? `${edition.name}-${edition.startDate}`}>
              {edition.slug ? (
                <Link
                  href={`/tournaments/${edition.slug}`}
                  aria-label={spokenLabel(edition)}
                  className="block rounded-[3px] outline-offset-2 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-amber-300"
                >
                  {tiles}
                </Link>
              ) : (
                <span className="sr-only">{spokenLabel(edition)}</span>
              )}
              {!edition.slug && tiles}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function FlipBoard({ editions, title }: { editions: TournamentEdition[]; title: string }) {
  if (editions.length === 0) return null;
  return (
    <section aria-label={title}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      <Board editions={editions} layout={LAYOUTS.narrow} className="sm:hidden" />
      <Board editions={editions} layout={LAYOUTS.wide} className="hidden sm:block" />
    </section>
  );
}
