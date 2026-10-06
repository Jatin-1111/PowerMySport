import type { EditionCircuit, EditionKind, AitaLadderRung } from "./editionSeries";

/**
 * Reading AITA's tournament calendar and fact-sheet pages.
 *
 * Pure functions over HTML strings: no network, no clock, no database. The reader
 * that fetches the pages lives in `AitaCalendarSource.ts`, and what is stored from
 * what is read is a separate decision. Keeping this part pure is what lets it be
 * tested against real pages saved as fixtures, which is the only protection it has
 * against the platform changing its markup.
 *
 * ── What the pages give us that the old calendar never did ──────────────────
 * The month page names each event's level in words, with its length ("Championship
 * Series (7 Days)"), so nothing has to be guessed from a free-form title that may
 * read "CS7", "CS (7)" or "AITA Championship Series -7 Days" for the same thing.
 * It also gives exact dates, the place, the age groups and whether entries are
 * open. The fact sheet adds the entry window, the withdrawal and freeze deadlines,
 * the entry fees, the surface and the venue.
 *
 * ── Failing loudly ─────────────────────────────────────────────────────────
 * A page that loads but holds no rows is the dangerous case: it looks like "no
 * events this month". `parseMonthPage` therefore returns an empty list only for a
 * page that says so in AITA's own words, and throws for any other page with no
 * rows, so a changed layout is a failed run and not a silently empty calendar.
 */

/** A calendar date, `YYYY-MM-DD`. Dates here are the printed ones, with no timezone. */
export type DateString = string;

export interface MonthRow {
  /** AITA's own id for the event, decoded from its fact-sheet address. */
  externalId: string;
  factSheetUrl: string;
  name: string;
  /** The level as printed, such as "Talent Series (7 Days)". */
  levelText: string | null;
  city: string | null;
  state: string | null;
  /** Under-N age groups listed for the event, ascending and de-duplicated. */
  ageGroups: number[];
  startDate: DateString;
  endDate: DateString;
  /** True when the row offers "Enter Tournament", which means entries are open. */
  entriesOpen: boolean;
  /** The countdown AITA prints beside an open event, when it prints one. */
  daysLeftToEnter: number | null;
}

export interface Deadline {
  date: DateString;
  /** `HH:MM` in IST as printed, when a time is printed. */
  time: string | null;
}

export interface FactSheet {
  levelText: string | null;
  startDate: DateString | null;
  endDate: DateString | null;
  qualifyingFirstDay: DateString | null;
  mainDrawFirstDay: DateString | null;
  entryOpens: DateString | null;
  entryCloses: Deadline | null;
  withdrawalDeadline: Deadline | null;
  freezeDeadline: Deadline | null;
  /** Rupees. Null when the page prints no fee, which is not the same as free. */
  feeSingles: number | null;
  feeDoubles: number | null;
  /** Paid by the tournament to main-draw players, per day. */
  dailyAllowance: number | null;
  surface: string | null;
  mainDrawCourts: number | null;
  indoorOutdoor: string | null;
  balls: string | null;
  /** The events played, as printed: "Boys 12&Under, Girls 12&Under". */
  eventsPlayed: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
}

// ─── Small helpers ────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&#039;": "'",
  "&#39;": "'",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
};

export const decodeEntities = (value: string): string =>
  value.replace(/&(?:amp|#0?39|quot|lt|gt|nbsp);/g, (entity) => ENTITIES[entity] ?? entity);

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/**
 * "31-Oct-2026", "03 Oct 2026" and "05-Oct-2026" are all in use, sometimes in the
 * same fact sheet, so this reads any of them. Null for anything else, including an
 * impossible date, which would otherwise travel on as a real one.
 */
export function parseDate(text: string | null | undefined): DateString | null {
  const match = /(\d{1,2})[\s-]+([A-Za-z]{3})[A-Za-z]*[\s-]+(\d{4})/.exec(text ?? "");
  if (!match) return null;
  const month = MONTHS[match[2]!.toLowerCase()];
  if (!month) return null;
  const iso = `${match[3]}-${month}-${match[1]!.padStart(2, "0")}`;
  const check = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== iso ? null : iso;
}

function parseDeadline(text: string | null): Deadline | null {
  const date = parseDate(text);
  if (!date) return null;
  const time = /(\d{1,2}):(\d{2})/.exec(text ?? "");
  return { date, time: time ? `${time[1]!.padStart(2, "0")}:${time[2]}` : null };
}

/** "600 INR" becomes 600. Anything else becomes null rather than a guess. */
function parseRupees(text: string | null): number | null {
  const match = /^\s*([\d,]+)\s*(?:INR|Rs\.?|₹)?\s*$/i.exec(text ?? "");
  if (!match) return null;
  const value = Number(match[1]!.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

/** The numeric id inside a fact-sheet address, which AITA base64-encodes. */
export function externalIdFromUrl(url: string): string | null {
  const encoded = /tournament-acceptance-factsheet-([A-Za-z0-9+/=]+)/.exec(url)?.[1];
  if (!encoded) return null;
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  return /^\d+$/.test(decoded) ? decoded : null;
}

// ─── The month page ───────────────────────────────────────────────────────────

const NO_RECORDS = /!!\s*No Records Found\s*!!/i;

/** "Bengaluru, Karnataka" is a city and a state; a lone word is only a state. */
function splitPlace(place: string | null): { city: string | null; state: string | null } {
  if (!place) return { city: null, state: null };
  const parts = place
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return { city: null, state: null };
  if (parts.length === 1) return { city: null, state: parts[0]! };
  return { city: parts.slice(0, -1).join(", "), state: parts[parts.length - 1]! };
}

export function parseMonthPage(html: string): MonthRow[] {
  const rows: MonthRow[] = [];

  for (const block of html.split(/(?=<div class="tour-row">)/)) {
    if (!block.startsWith('<div class="tour-row">')) continue;

    const link = /href="([^"]*tournament-acceptance-factsheet-[^"]+)"[^>]*title="([^"]*)"/.exec(
      block
    );
    const when = /(\d{2}-[A-Za-z]{3}-\d{4})\s+to\s+(\d{2}-[A-Za-z]{3}-\d{4})/.exec(block);
    if (!link || !when) continue;

    const externalId = externalIdFromUrl(link[1]!);
    const startDate = parseDate(when[1]);
    const endDate = parseDate(when[2]);
    // A row we cannot place on the calendar is skipped, not guessed at. The count
    // check below turns a page where every row was skipped into an error.
    if (!externalId || !startDate || !endDate) continue;

    const level = /class="tc-grade">([^<]*)</.exec(block)?.[1];
    const place = /alt=""\s*\/>\s*([^<]+)<\/span>\s*<\/p>/.exec(block)?.[1];
    const { city, state } = splitPlace(place ? decodeEntities(place).trim() : null);
    const ages = [...block.matchAll(/class="badge">(\d+)</g)].map((m) => Number(m[1]));
    const left = /(\d+)\s+Days?\s+Left/i.exec(block);

    rows.push({
      externalId,
      factSheetUrl: link[1]!,
      name: decodeEntities(link[2]!).trim(),
      levelText: level ? decodeEntities(level).trim() || null : null,
      city,
      state,
      ageGroups: [...new Set(ages)].sort((a, b) => a - b),
      startDate,
      endDate,
      entriesOpen: /Enter Tournament/i.test(block),
      daysLeftToEnter: left ? Number(left[1]) : null,
    });
  }

  if (rows.length === 0 && !NO_RECORDS.test(html)) {
    throw new Error(
      "The calendar page had no events and did not say it had none. AITA may have " +
        "changed the page, so this is a failed read and not an empty month."
    );
  }
  return rows;
}

// ─── The fact sheet ───────────────────────────────────────────────────────────

/** The page's visible text, one value or label per line. */
function textOf(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n+/g, "\n");
}

/**
 * The value printed after a label: on the same line after a colon, or on the next
 * line. `from` lets a caller start reading after an earlier marker, because "State"
 * and "City" each appear more than once on the page.
 */
function valueAfter(text: string, label: string, from = 0): string | null {
  const pattern = new RegExp(`${label}\\s*:?\\s*\\n?\\s*([^\\n]+)`);
  const match = pattern.exec(text.slice(from));
  const value = match?.[1]?.trim();
  return value ? value : null;
}

export function parseFactSheet(html: string): FactSheet {
  const text = textOf(html);

  // Venue labels repeat elsewhere on the page ("State" in an administration block),
  // so read them from the venue block, which starts at "Country".
  const venueFrom = Math.max(0, text.search(/Country\s*:/));

  // Stops at the closing bracket of "(7 Days)" so a "· India" printed after it on the
  // same line is not taken as part of the level.
  const level =
    /((?:Talent|Championship|Super|National) Series(?:\s*\(\d+\s*Days?\))?|Nationals)/.exec(
      text
    )?.[1];

  return {
    levelText: level ? level.trim() : null,
    startDate: parseDate(valueAfter(text, "Start of Tournament")),
    endDate: parseDate(valueAfter(text, "End of Tournament")),
    qualifyingFirstDay: parseDate(valueAfter(text, "Qualifying Draw First Day")),
    mainDrawFirstDay: parseDate(valueAfter(text, "Main Draw First Day")),
    entryOpens: parseDate(valueAfter(text, "Entry Opens")),
    entryCloses: parseDeadline(valueAfter(text, "Closing Deadline")),
    withdrawalDeadline: parseDeadline(valueAfter(text, "Withdrawal Deadline")),
    freezeDeadline: parseDeadline(valueAfter(text, "Freeze Deadline")),
    feeSingles: parseRupees(valueAfter(text, "Entry Fee Single")),
    feeDoubles: parseRupees(valueAfter(text, "Entry Fee Double")),
    dailyAllowance: parseRupees(valueAfter(text, "Daily Allowance")),
    surface: valueAfter(text, "Main Draw Courts Surface Type"),
    mainDrawCourts: (() => {
      const courts = valueAfter(text, "No\\. of Main Draw Courts");
      return courts && /^\d+$/.test(courts) ? Number(courts) : null;
    })(),
    indoorOutdoor: valueAfter(text, "Indoors/Outdoors Courts"),
    balls: valueAfter(text, "Make of balls"),
    eventsPlayed: valueAfter(text, "Event Played"),
    country: valueAfter(text, "Country", venueFrom),
    state: valueAfter(text, "State", venueFrom),
    city: valueAfter(text, "City", venueFrom),
  };
}

// ─── Level text to the vocabulary the rest of the code already uses ──────────

export interface LevelClass {
  ladder: AitaLadderRung | null;
  /** Days the event runs, for the series that print it. */
  days: number | null;
  circuit: EditionCircuit | null;
  kind: EditionKind;
}

const UNKNOWN_LEVEL: LevelClass = { ladder: null, days: null, circuit: null, kind: "unknown" };

/**
 * What AITA's printed level means, in `editionSeries`' own terms.
 *
 * Read from the level text and not the title, because the level is a controlled
 * phrase and the title is whatever the organiser typed. Anything not recognised is
 * "unknown", which the entry rules treat as "do not offer", so a new level AITA
 * invents is hidden until someone teaches this function about it.
 */
export function classifyLevel(levelText: string | null | undefined): LevelClass {
  const text = (levelText ?? "").trim();
  const days = /\((\d+)\s*Days?\)/i.exec(text);
  const dayCount = days ? Number(days[1]) : null;

  const ladder = (rung: AitaLadderRung): LevelClass => ({
    ladder: rung,
    days: dayCount,
    circuit: "AITA",
    kind: "junior-ladder",
  });

  if (/^Talent Series/i.test(text)) return ladder("Talent Series");
  if (/^Championship Series/i.test(text)) return ladder("Championship Series");
  if (/^Super Series/i.test(text)) return ladder("Super Series");
  if (/^National Series/i.test(text)) return ladder("National Series");
  if (/^Nationals?\b/i.test(text)) return ladder("Nationals");

  if (/^ITF Juniors?/i.test(text)) {
    return { ladder: null, days: null, circuit: "ITF", kind: "international-junior" };
  }
  if (/^Asian Under/i.test(text)) {
    return { ladder: null, days: null, circuit: "ATF", kind: "international-junior" };
  }
  if (/^AITA Pro Circuit/i.test(text)) {
    return { ladder: null, days: null, circuit: "AITA", kind: "senior-prize-money" };
  }
  if (/^ITF World Tennis Masters/i.test(text)) {
    return { ladder: null, days: null, circuit: "ITF", kind: "masters" };
  }
  if (/^WTA\b/i.test(text)) return { ladder: null, days: null, circuit: "WTA", kind: "pro-tour" };
  if (/^ATP\b/i.test(text)) return { ladder: null, days: null, circuit: "ATP", kind: "pro-tour" };

  return UNKNOWN_LEVEL;
}
