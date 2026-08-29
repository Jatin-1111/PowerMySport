import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import {
  ParsedPointBreakdown,
  ParsedRankingRow,
  ParseResult,
  SourceMovement,
} from "./types";
import { resolveStateCode } from "./stateCodes";

/**
 * Turns an AITA `ranking-view` page into rows.
 *
 * This replaces `rankingPdfParser.ts`, and the change is a straight
 * simplification: the old file spent 470 lines on PDF geometry — matching cells
 * to columns by header-span overlap, refusing to pre-merge fragments, carrying
 * three different header vocabularies — because the source was an Excel export
 * flattened through Ghostscript and column identity had to be *inferred from
 * pixel positions*. The new source names every field in markup.
 *
 * ── What that geometry work bought, and what replaces it ──────────────────────
 * Nothing is lost. The problems it solved no longer exist:
 *   · Three header vocabularies (`NAME OF PLAYER` vs `Given Name`+`Family Name`,
 *     `DOB` vs `D.O.B`) — the markup has one shape.
 *   · Centroid drift on long left-aligned names — there are no columns.
 *   · Two-digit year pivoting for DOB — the source publishes year of birth only.
 *
 * ── The strictness does carry over, and matters more, not less ────────────────
 * A wrong-but-plausible ranking is still the one failure that would cost a
 * parent's trust permanently, and the platform is weeks old. So: a page with no
 * cards throws, a card missing its identity fields is counted as malformed
 * rather than filled with defaults, and the page's own echoed-back `weekof_int`
 * and `category` are captured so the ingest can prove the server returned the
 * list that was asked for.
 *
 * That last check is stronger than the printed-"As on"-line check it replaces.
 * The old one read a label AITA typed by hand, and cost nine false quarantines
 * over zero-padded days ("As on 02nd Feb , 2026"). This one reads what the
 * server itself thinks it served.
 */

/** A page that comes back exactly this full was probably truncated, not complete. */
export interface ParseListOptions {
  /** The `record` value the list was requested with, if known. */
  requestedPageSize?: number;
}

export function parseRankingList(
  html: string,
  options: ParseListOptions = {},
): ParseResult {
  const $ = cheerio.load(html);

  const diagnostics: ParseResult["diagnostics"] = {
    malformedRows: 0,
    missingDob: 0,
    unknownStateCodes: [],
    unknownStateRows: 0,
    unparsedLines: [],
    warnings: [],
  };

  const cards = $("div.rankingCard");
  if (cards.length === 0) {
    throw new Error(
      "Ranking page contains no `div.rankingCard` rows — the source layout has " +
        "changed. Refusing to guess.",
    );
  }

  const rows: ParsedRankingRow[] = [];
  const unknownCodes = new Set<string>();

  cards.each((_, element) => {
    const card = $(element);
    const row = readCard($, card, diagnostics);
    if (!row) return;

    if (row.stateCode && !resolveStateCode(row.stateCode)) {
      unknownCodes.add(row.stateCode);
      diagnostics.unknownStateRows++;
    }
    if (row.birthYear === null) diagnostics.missingDob++;
    rows.push(row);
  });

  diagnostics.unknownStateCodes = [...unknownCodes];

  // Keep the diagnostic bounded — a systemic break would otherwise store the
  // whole document on the snapshot.
  if (diagnostics.unparsedLines.length > 25) {
    const total = diagnostics.unparsedLines.length;
    diagnostics.unparsedLines = diagnostics.unparsedLines.slice(0, 25);
    diagnostics.warnings.push(`${total} unreadable cards, showing first 25`);
  }

  // Truncation looks exactly like success, so it has to be checked for rather
  // than noticed. `record` is not enforced server-side today, but "today" is
  // three weeks old.
  const pageSize = options.requestedPageSize;
  if (pageSize && cards.length >= pageSize) {
    throw new Error(
      `Ranking page returned ${cards.length} rows against a requested page size ` +
        `of ${pageSize} — the list is probably truncated. Raise the page size ` +
        `rather than publishing a partial list.`,
    );
  }

  return {
    rows,
    columns: LIST_COLUMNS,
    sourceWeekof: readInlineNumber(html, "weekof_int"),
    sourceCategory: readInlineString(html, "category"),
    diagnostics,
  };
}

/**
 * The list page prints one points figure per player, so this is the whole column
 * set. Point *composition* now lives behind a per-player endpoint — see
 * `parsePointBreakdown`.
 */
const LIST_COLUMNS = ["Rank", "Player", "State", "Total Pts."];

/** Reads one card, or counts it as malformed and returns null. */
function readCard(
  $: cheerio.CheerioAPI,
  card: cheerio.Cheerio<AnyNode>,
  diagnostics: ParseResult["diagnostics"],
): ParsedRankingRow | null {
  const nameLink = card.find("a.rr-name").first();

  // `data-rank` is the server's own value; the printed cell is the fallback,
  // because a medal badge wraps it in an extra span.
  const rank =
    toInt(nameLink.attr("data-rank")) ??
    toInt(card.find("span.rr-rank").first().text());
  const playerKey = (nameLink.attr("data-player") ?? "").trim();
  const fullName = normaliseSpace(nameLink.attr("title") || nameLink.text());

  // The registration number is not printed on its own anywhere on this page —
  // it is inside the base64 player key. Recovering it is what keeps the primary
  // key (asOnDate, category, subcategory, regNo) continuous across the cutover,
  // which is what keeps week-over-week movement working on archived rows.
  const regNo = regNoFromPlayerKey(playerKey);

  if (rank === null || !playerKey || !regNo || !fullName) {
    diagnostics.malformedRows++;
    diagnostics.unparsedLines.push(
      normaliseSpace(card.text()).slice(0, 200) || "(empty card)",
    );
    return null;
  }

  const totalPoints =
    toFloat(card.find("span.total-pts").first().text()) ??
    toFloat(card.find("span.points").first().text()) ??
    0;

  const state = readState($, card);

  return {
    rank,
    // The list page gives one name field. The family name is upper-cased, but
    // "Thanush Shekar B C" shows why that is not a delimiter worth trusting —
    // so the split stays unavailable here rather than guessed at. Tournament
    // acceptance lists do publish it split, if we ever need it.
    givenName: "",
    familyName: "",
    fullName,
    regNo,
    playerKey,
    dob: null,
    birthYear: toInt(card.find("span.yob").first().text()),
    stateCode: state.code,
    points: [{ label: "Total Pts.", value: totalPoints }],
    totalPoints,
    tournamentsPlayed: toInt(card.find("span.tour-played").first().text()),
    wtnSingles: readWtn(card, 0),
    wtnDoubles: readWtn(card, 1),
    photoUrl: card.find("span.rr-avatar img").first().attr("src")?.trim() || null,
    sourceMovement: readMovement(card),
  };
}

/**
 * State comes off the filter link the row carries, not its label text.
 *
 * The visible text is the canonical name, which we could use — but the href
 * carries the code, and the code is what the rest of the pipeline resolves
 * through `stateCodes.ts`. Reading the code keeps one resolution path.
 */
function readState(
  $: cheerio.CheerioAPI,
  card: cheerio.Cheerio<AnyNode>,
): { code: string | null; name: string | null } {
  const link = card.find("small.rr-sub a[href*='state=']").first();
  const href = link.attr("href") ?? "";
  const match = href.match(/[?&]state=([A-Za-z]{2})\b/);
  const name = normaliseSpace(link.text()) || null;
  return { code: match?.[1] ? match[1].toUpperCase() : null, name };
}

/**
 * Movement since the previous week.
 *
 * Direction comes from the icon, magnitude from the text, and the magnitude is
 * absolute-valued — down-movers render their number already signed ("-13") while
 * up-movers do not ("1"), so trusting the sign would flip half the rows.
 *
 * A dash is returned as "none", which is *not* the same as "unchanged": the
 * source renders no-movement and no-baseline identically. That ambiguity is why
 * this is a cross-check and `prevRank` stays derived from our own archive.
 */
function readMovement(card: cheerio.Cheerio<AnyNode>): SourceMovement | null {
  const cell = card.find("span.rr-move").first();
  if (cell.length === 0) return null;

  const icon = cell.find("i").first().attr("class") ?? "";
  const places = Math.abs(toFloat(cell.text()) ?? 0);

  if (/alt-up/.test(icon)) return { direction: "up", places };
  if (/alt-down/.test(icon)) return { direction: "down", places };
  return { direction: "none", places: 0 };
}

/** WTN singles (index 0) or doubles (index 1). Almost always absent. */
function readWtn(card: cheerio.Cheerio<AnyNode>, index: number): number | null {
  const value = card.find("div.rr-wtn span.wtn-val b").eq(index).text();
  return toFloat(value);
}

/**
 * `UklBTkFONDQwMDkw` -> `440090`.
 *
 * The key decodes to a 3+3 letter name prefix followed by the AITA registration
 * number — `RIANAN440090` for Riaan Atul Nandankar, `DHASMX437729` for Dhanush
 * SM (short names are padded with X). Only the digits are the identifier.
 *
 * Returns null rather than a partial match: a key we cannot decode means the
 * scheme changed, and inventing a key would merge two players' histories.
 */
export function regNoFromPlayerKey(playerKey: string): string | null {
  if (!playerKey) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(playerKey, "base64").toString("utf8");
  } catch {
    return null;
  }
  const match = decoded.match(/(\d{4,8})\s*$/);
  return match?.[1] ?? null;
}

/**
 * One player's point breakdown, from the `ranking-player-point-view` fragment.
 *
 * ── Why this endpoint matters out of proportion to its size ───────────────────
 * The bracket above rolls down into a junior's total *in full* and was never
 * printed as a column on the old PDFs — 81% of a U-16 leader's points could be
 * his U-18 total, invisibly. We recovered it as a residual. The new fragment
 * labels it: for a U-12 player it appears as a `14&Under` row, and
 * `725.00 + 168.75 + 255.25 = 1149.00` reconciles to the paisa.
 *
 * ── The source marks its own scoring components ───────────────────────────────
 * Components that count toward the total carry `is-hot`; the raw `Best 8 Dbls`
 * column, `Penalty Pts` and `Total Pts` do not. That is convenient, and it is
 * also a CSS class on a three-week-old platform — so it is read as corroboration
 * while the label rules below do the actual classifying.
 */
export function parsePointBreakdown(fragment: string): ParsedPointBreakdown {
  const $ = cheerio.load(fragment);

  let rank: number | null = null;
  let totalPoints: number | null = null;
  const slices: ParsedPointBreakdown["slices"] = [];

  // ── Whether the raw doubles column scores depends on the list ────────────────
  // On the junior and open-*singles* lists both `Best 8 Dbls` and its
  // `25% Best 8 Dbls` sibling are printed, and only the quarter counts — stacking
  // both double-counts doubles.
  //
  // The doubles lists print no quarter sibling, because there is nothing to take
  // a quarter of: `Best 8 Dbls` *is* the score. Flagging it informational there
  // zeroes the only domestic column on the sheet, and a Women's Doubles player at
  // rank 163 with a total of 10 reconciles to 0 — which is how two thirds of that
  // list got thrown out of the first sample.
  //
  // Same conditional rule `componentColumns` uses on stored rows. The two must
  // agree or a row is classified one way at ingest and the other at read.
  const labels = $("div.pv-stat span.lbl")
    .map((_, el) => normaliseSpace($(el).text()))
    .get();
  const hasQuarterDoubles = labels.some(
    (l) => /\b25\s*%/.test(l) && /DBLS|DOUBLES/i.test(l),
  );

  $("div.pv-stat").each((_, element) => {
    const stat = $(element);
    const label = normaliseSpace(stat.find("span.lbl").first().text());
    const rawValue = stat.find("span.val").first().text();
    if (!label) return;

    if (/^rank$/i.test(label)) {
      rank = toInt(rawValue);
      return;
    }
    if (/^total\s*pts?\.?$/i.test(label)) {
      totalPoints = toFloat(rawValue) ?? 0;
      return;
    }

    // A dash means the component does not apply to this player, which is a
    // legitimate zero rather than missing data.
    const value = toFloat(rawValue) ?? 0;

    slices.push({
      label,
      value,
      // Only informational where the scoring sibling actually exists — see the
      // note above `hasQuarterDoubles`.
      isInformational:
        hasQuarterDoubles &&
        /DBLS|DOUBLES/i.test(label) &&
        !/\b25\s*%/.test(label),
      isDeduction: /penalt/i.test(label),
      isRollDown: isRollDownLabel(label),
    });
  });

  return { rank, slices, totalPoints };
}

/**
 * Whether a slice is points carried in from a category above this one.
 *
 * Their markup calls it the "Previous/Upper category point", and the wording
 * varies more than a single pattern suggests — measured across three list types
 * on 2026-08-29:
 *
 *   · U-12 / U-14 / U-16 → `14&Under`, `16&Under`, `18&Under`
 *   · U-18              → `Under Mens` and `Mens`
 *   · Men's / Women's   → none, as expected; nothing sits above them
 *
 * That U-18 draws from the senior lists is worth noting on its own — our
 * `nextBracketUp()` stops at U-18 on the reasoning that nothing is above it,
 * which is true of the *junior* ladder but not of where the points come from.
 *
 * This flag is for labelling only. Nothing arithmetic depends on it: the
 * composition uses the printed values, which reconcile exactly.
 */
function isRollDownLabel(label: string): boolean {
  const l = label.trim();
  if (/^\d{1,2}\s*&\s*under$/i.test(l)) return true;
  return /^(under\s+)?(mens|men's|womens|women's)$/i.test(l);
}

/**
 * Reads `var weekof_int = 1786300200;` out of the page's inline script.
 *
 * The page echoes back which week and which list the server actually served.
 * Cheap, and it turns "the server quietly served a default" from an
 * undetectable mis-filing into a caught error.
 */
function readInlineNumber(html: string, name: string): number | null {
  const match = html.match(
    new RegExp(`\\b(?:var|let|const)\\s+${name}\\s*=\\s*(-?\\d+)`),
  );
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

/** Reads `var category="BS12";` out of the page's inline script. */
function readInlineString(html: string, name: string): string | null {
  const match = html.match(
    new RegExp(`\\b(?:var|let|const)\\s+${name}\\s*=\\s*["']([^"']*)["']`),
  );
  return match?.[1]?.trim() || null;
}

/** Collapses whitespace, including the `&nbsp;` the state links are padded with. */
function normaliseSpace(value: string | undefined): string {
  return (value ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

/** Integer or null. Blanks, dashes and stray markup all mean "absent". */
export function toInt(raw: string | undefined): number | null {
  const value = Number.parseInt((raw ?? "").replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(value) ? value : null;
}

/** Float or null. Same rules as `toInt`, decimals allowed. */
export function toFloat(raw: string | undefined): number | null {
  const cleaned = (raw ?? "").replace(/,/g, "").replace(/[^0-9.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}
