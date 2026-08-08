import { ParseResult, ParsedRankingRow } from "./types";
import { parseStateCell, resolveStateCode } from "./stateCodes";

/**
 * Turns an AITA ranking PDF into rows.
 *
 * These files are Excel exported through PDF24 and Ghostscript, so they carry a
 * real text layer with embedded Calibri subsets — there is nothing to OCR and
 * nothing to guess. What there *is* to get right is the geometry.
 *
 * ── Columns are matched by centroid, not by left edge ─────────────────────────
 * Family Name is left-aligned at a fixed x; Given Name is right-aligned, so its
 * x swings from 113 to 178 depending on how long the name is; the numeric
 * columns are right-aligned too. Bucketing by left edge, or by midpoints
 * between header positions, shreds long names — "SANJAY PRABHAKARAN" starts to
 * the left of where "Given Name" is printed. Matching each cell's centre
 * against each header's centre is exact: "400" centres on 369.7 against the
 * PTS. header's 369.65, and the worst observed error is under 3pt against a
 * column pitch of ~30pt.
 *
 * ── Only page 1 has a header ─────────────────────────────────────────────────
 * Page 2 onward start straight on a data row, so the column model is derived
 * once and applied to every page.
 *
 * ── Failure is loud ──────────────────────────────────────────────────────────
 * The identity columns are matched by pattern and their absence throws, so a
 * layout change stops the run instead of quietly producing plausible nonsense.
 * Column *labels* are best-effort (composed from the stacked header rows above
 * the anchor); column *structure* is strict.
 *
 * That strictness is not theoretical caution. A single week's twelve lists use
 * three different header vocabularies, and the first full sweep failed six of
 * them loudly — which is exactly what should happen, and what a lenient parser
 * would instead have published as wrong data.
 */

/**
 * Identity columns and the spellings AITA actually uses for them.
 *
 * The variants are not hypothetical — a single week's twelve lists contain
 * three different header vocabularies. `DOB` is printed `D.O.B` on both U-18
 * lists, and the U-12 and U-16 lists replace the `Given Name`/`Family Name`
 * pair with one `NAME OF PLAYER` column. Anything not covered here fails the
 * run rather than being guessed at.
 */
const IDENTITY_COLUMNS = [
  { key: "rank", pattern: /^RANK$/i },
  // Order matters. On some weeks the two name headers are printed close enough
  // to overlap and arrive as one cell ("Given Name Family Name"); matching that
  // first claims the cell as a single name column, where matching `givenName`
  // first would take it and then leave `familyName` unmatched and fail the run.
  // Either way the data still lands in one column, so `fullName` is correct and
  // the given/family split is simply unavailable for that week.
  { key: "wholeName", pattern: /given\s*name\s*family\s*name/i },
  { key: "wholeName", pattern: /^NAME\s*OF\s*PLAYER$/i },
  { key: "givenName", pattern: /given\s*name/i },
  { key: "familyName", pattern: /family\s*name/i },
  { key: "regNo", pattern: /^REG\.?\s*NO\.?$/i },
  { key: "dob", pattern: /^D\.?\s*O\.?\s*B\.?$/i },
  { key: "state", pattern: /^STATE$/i },
] as const;

/** Present on every list, whatever it calls its name column(s). */
const REQUIRED_COLUMNS = ["rank", "regNo", "dob", "state"] as const;

/** Columns where several text fragments legitimately make up one value. */
const NAME_COLUMN_KEYS = new Set(["givenName", "familyName", "wholeName"]);

/**
 * Only *overlapping* fragments are pre-merged. Anything wider is left alone and
 * rejoined later by column assignment, which is the safer order: adjacent
 * header cells are genuinely close — `Given Name` and `Family Name` sit 2.4pt
 * apart, `NO SHOW` and `25 % PTS.` 3.9pt — so any positive gap threshold large
 * enough to be useful also fuses columns that must stay separate.
 */
const CELL_MERGE_GAP = 0;
/** Text baselines within this many points are the same visual row. */
const ROW_TOLERANCE = 2.5;
/** A cell further than this from every header centre is unassignable. */
const MAX_COLUMN_DISTANCE = 22;

/** Exported with `nearestColumn`, `parseDob` and `parseNumber` so the geometry
 * and coercion rules can be pinned by tests without a PDF fixture — the repo
 * should not carry a file full of children's dates of birth just to have
 * something to parse. */
export interface Cell {
  x: number;
  width: number;
  center: number;
  text: string;
}
interface Row {
  y: number;
  cells: Cell[];
}
export interface Column {
  center: number;
  /** x-extent of the printed header text, used for overlap matching. */
  start: number;
  end: number;
  label: string;
  /** Set for the six identity columns; undefined for points columns. */
  key?: string;
}

/**
 * pdfjs-dist v4 ships ESM only, and this package is compiled to CommonJS —
 * TypeScript would rewrite a plain `import()` into `require()` and fail at
 * runtime. `new Function` keeps a genuine dynamic import in the output.
 */
const importEsm = new Function("s", "return import(s)") as (
  s: string,
) => Promise<any>;

export async function parseRankingPdf(buffer: Buffer): Promise<ParseResult> {
  const pdfjs = await importEsm("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    // The files reference a TrueType hinting function pdfjs does not implement;
    // it is cosmetic and would otherwise log once per page.
    verbosity: 0,
  }).promise;

  const diagnostics: ParseResult["diagnostics"] = {
    malformedRows: 0,
    missingDob: 0,
    unknownStateCodes: [],
    unknownStateRows: 0,
    unparsedLines: [],
    warnings: [],
  };

  const pageRows: Row[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    pageRows.push(toRows(content.items));
  }

  const firstPage = pageRows[0] ?? [];
  const anchorIndex = firstPage.findIndex(isAnchorRow);
  if (anchorIndex === -1) {
    throw new Error(
      "Ranking PDF has no recognisable header row (expected RANK … REG NO.). " +
        "The source layout has changed — refusing to guess.",
    );
  }
  const anchorRow = firstPage[anchorIndex]!;
  const columns = buildColumns(anchorRow, firstPage.slice(0, anchorIndex), diagnostics);

  const asOnLabel = findAsOnLabel(firstPage);

  const rows: ParsedRankingRow[] = [];
  const unknownCodes = new Set<string>();
  const currentCentury = Math.floor(new Date().getUTCFullYear() / 100) * 100;
  const pivot = new Date().getUTCFullYear() % 100;

  for (let p = 0; p < pageRows.length; p++) {
    for (const row of pageRows[p] ?? []) {
      // Page 1's own header band must not be read as data.
      if (p === 0 && row.y >= anchorRow.y) continue;

      const byKey = assignRow(row, columns, diagnostics);
      const regNo = (byKey.get("regNo") ?? "").trim();
      if (!/^\d{4,8}$/.test(regNo)) {
        // Not a data row. Only flag it if it looked like one.
        if (row.cells.length >= 4) {
          diagnostics.unparsedLines.push(row.cells.map((c) => c.text).join(" | "));
        }
        continue;
      }

      const rank = Number.parseInt((byKey.get("rank") ?? "").trim(), 10);
      if (!Number.isFinite(rank)) {
        diagnostics.malformedRows++;
        continue;
      }

      const rawState = byKey.get("state") ?? "";
      const stateCode = parseStateCell(rawState);
      if (stateCode && !resolveStateCode(stateCode)) {
        unknownCodes.add(stateCode);
        diagnostics.unknownStateRows++;
      }

      const dob = parseDob(byKey.get("dob") ?? "", currentCentury, pivot);
      if (!dob) diagnostics.missingDob++;

      const points = columns
        .filter((c) => !c.key)
        .map((c) => ({
          label: c.label,
          value: parseNumber(byKey.get(`col:${c.center}`) ?? ""),
        }));

      const givenName = (byKey.get("givenName") ?? "").trim();
      const familyName = (byKey.get("familyName") ?? "").trim();
      // Lists using a single NAME OF PLAYER column leave the pair empty; the
      // name is deliberately not split on whitespace, because "SANJAY
      // PRABHAKARAN CELIN" gives no reliable way to tell which part is which.
      const wholeName = (byKey.get("wholeName") ?? "").trim();
      const fullName = (wholeName || `${givenName} ${familyName}`)
        .replace(/\s+/g, " ")
        .trim();

      rows.push({
        rank,
        givenName,
        familyName,
        fullName,
        regNo,
        dob,
        stateCode,
        points,
        totalPoints: points[points.length - 1]?.value ?? 0,
      });
    }
  }

  diagnostics.unknownStateCodes = [...unknownCodes];
  // Keep the diagnostic bounded — a systemic break would otherwise store the
  // whole document on the snapshot.
  if (diagnostics.unparsedLines.length > 25) {
    const total = diagnostics.unparsedLines.length;
    diagnostics.unparsedLines = diagnostics.unparsedLines.slice(0, 25);
    diagnostics.warnings.push(`${total} unparsed lines, showing first 25`);
  }

  return {
    rows,
    columns: columns.map((c) => c.label),
    pageCount: doc.numPages,
    asOnLabel,
    diagnostics,
  };
}

/** Groups a page's text items into visual rows, merging fragments into cells. */
function toRows(items: Array<any>): Row[] {
  const buckets = new Map<number, Cell[]>();
  for (const item of items) {
    const text: string = typeof item.str === "string" ? item.str : "";
    if (!text.trim()) continue;
    const x: number = item.transform[4];
    const y: number = item.transform[5];
    const width: number = typeof item.width === "number" ? item.width : 0;

    let key = [...buckets.keys()].find((k) => Math.abs(k - y) <= ROW_TOLERANCE);
    if (key === undefined) {
      key = y;
      buckets.set(key, []);
    }
    buckets.get(key)!.push({ x, width, center: x + width / 2, text });
  }

  const rows: Row[] = [];
  for (const [y, raw] of buckets) {
    raw.sort((a, b) => a.x - b.x);
    const merged: Cell[] = [];
    for (const cell of raw) {
      const prev = merged[merged.length - 1];
      if (prev && cell.x - (prev.x + prev.width) < CELL_MERGE_GAP) {
        const right = Math.max(prev.x + prev.width, cell.x + cell.width);
        prev.text += cell.text;
        prev.width = right - prev.x;
        prev.center = prev.x + prev.width / 2;
      } else {
        merged.push({ ...cell });
      }
    }
    for (const cell of merged) cell.text = cell.text.trim();
    rows.push({ y, cells: merged.filter((c) => c.text.length > 0) });
  }
  return rows.sort((a, b) => b.y - a.y);
}

function isAnchorRow(row: Row): boolean {
  const joined = row.cells.map((c) => c.text).join(" ");
  return /\bRANK\b/i.test(joined) && /REG\.?\s*NO/i.test(joined);
}

/**
 * Builds the column model from the anchor row, then labels the points columns
 * using the stacked header rows above it.
 *
 * Only points columns get composed labels. The rows above also carry the list
 * title and the as-on date, which sit over the name columns — pulling those in
 * would produce labels like "BOY'S UNDER-14 27th July, 2026 Given Name".
 */
function buildColumns(
  anchorRow: Row,
  rowsAbove: Row[],
  diagnostics: ParseResult["diagnostics"],
): Column[] {
  const columns: Column[] = anchorRow.cells.map((cell) => ({
    center: cell.center,
    start: cell.x,
    end: cell.x + cell.width,
    label: cell.text,
  }));

  const assigned = new Set<string>();
  for (const { key, pattern } of IDENTITY_COLUMNS) {
    // Two entries share the `wholeName` key (the merged-header and the
    // NAME OF PLAYER spellings). Once one has claimed a column, the other must
    // not go looking for a second one to claim.
    if (assigned.has(key)) continue;
    const match = columns.find((c) => !c.key && pattern.test(c.label));
    if (match) {
      match.key = key;
      assigned.add(key);
    }
  }

  const seen = new Set(columns.map((c) => c.key).filter(Boolean));
  const describe = () => columns.map((c) => c.label).join(", ");
  for (const key of REQUIRED_COLUMNS) {
    if (!seen.has(key)) {
      throw new Error(
        `Ranking PDF header is missing the "${key}" column ` +
          `(saw: ${describe()}). Refusing to guess.`,
      );
    }
  }
  // Either the split pair or the single column, never neither.
  const hasSplitName = seen.has("givenName") && seen.has("familyName");
  if (!hasSplitName && !seen.has("wholeName")) {
    throw new Error(
      `Ranking PDF header has no usable name column — expected ` +
        `"Given Name" + "Family Name" or "NAME OF PLAYER" (saw: ${describe()}). ` +
        `Refusing to guess.`,
    );
  }

  const stateColumn = columns.find((c) => c.key === "state")!;
  const pointsColumns = columns.filter((c) => !c.key && c.center > stateColumn.center);
  if (pointsColumns.length === 0) {
    throw new Error("Ranking PDF header has no points columns after STATE.");
  }
  // Anything unkeyed to the LEFT of STATE is unexpected; note it rather than
  // silently treating it as a points column.
  for (const c of columns) {
    if (!c.key && c.center <= stateColumn.center) {
      diagnostics.warnings.push(`Unexpected header column before STATE: "${c.label}"`);
    }
  }

  // Header rows sit directly above the anchor; the title block is further up.
  // Four covers both observed layouts and stops before the association name.
  const band = rowsAbove.slice(-4);
  for (const column of pointsColumns) {
    const parts: string[] = [];
    for (const row of band) {
      for (const cell of row.cells) {
        if (cell.center <= stateColumn.center) continue;
        if (nearestColumn(cell, pointsColumns) === column) parts.push(cell.text);
      }
    }
    parts.push(column.label);
    column.label = parts.join(" ").replace(/\s+/g, " ").trim();
  }

  return columns;
}

/** Maps every cell in a row onto a column, keyed by identity key or centre. */
function assignRow(
  row: Row,
  columns: Column[],
  diagnostics: ParseResult["diagnostics"],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const cell of row.cells) {
    const column = nearestColumn(cell, columns);
    if (!column) {
      // Dropping a cell silently would truncate a name with nothing to show
      // for it, so an unplaceable cell is always surfaced.
      diagnostics.warnings.push(`Unplaceable cell at x=${Math.round(cell.x)}: "${cell.text}"`);
      continue;
    }
    const key = column.key ?? `col:${column.center}`;
    const existing = out.get(key);
    out.set(key, existing ? `${existing} ${cell.text}` : cell.text);
    // Names arrive as several fragments all the time ("V" + "S", or "ARNAV" +
    // "BEHERA" in a single NAME OF PLAYER column), so joining is expected
    // there. Anywhere else it means two columns collapsed into one, which is
    // the geometry assumption breaking and worth surfacing.
    if (existing && !NAME_COLUMN_KEYS.has(column.key ?? "")) {
      diagnostics.warnings.push(
        `Two cells mapped to column "${column.label}": "${existing}" + "${cell.text}"`,
      );
    }
  }
  return out;
}

/**
 * Assigns a cell to a column, preferring the column whose printed header the
 * cell physically overlaps and falling back to the nearest centre.
 *
 * Overlap first, because centre distance alone is not safe for the wide
 * left-aligned Family Name column: a cell's centroid drifts right as the name
 * gets longer, and the widest real one in a single Boys U-14 list
 * ("SADASIVAM RAJESH KANNAN") lands 21.8pt from the header centre — 0.2pt
 * inside the old cutoff. Raising the cutoff instead would start stealing cells
 * from the next column. Overlap has no such tension here: Given Name is
 * right-aligned ending at 177.1 and Family Name starts at 179.5, so the two
 * spans never cross however long either name gets.
 *
 * The centre fallback still covers right-aligned numerics, whose cells sit
 * inside the header span anyway, and short cells that fall between headers.
 */
export function nearestColumn(cell: Cell, columns: Column[]): Column | null {
  const cellEnd = cell.x + cell.width;

  let byOverlap: Column | null = null;
  let bestOverlap = 0;
  for (const column of columns) {
    const overlap = Math.min(cellEnd, column.end) - Math.max(cell.x, column.start);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      byOverlap = column;
    }
  }
  if (byOverlap) return byOverlap;

  let byCentre: Column | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const column of columns) {
    const distance = Math.abs(cell.center - column.center);
    if (distance < bestDistance) {
      bestDistance = distance;
      byCentre = column;
    }
  }
  return bestDistance <= MAX_COLUMN_DISTANCE ? byCentre : null;
}

/**
 * `20-Jun-12` -> 2012-06-20. Two-digit years pivot on the current year, which
 * is right for both a twelve-year-old (12 -> 2012) and a senior (97 -> 1997).
 */
export function parseDob(raw: string, currentCentury: number, pivot: number): Date | null {
  const m = raw.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  const months = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
  const month = months.indexOf(m[2].toLowerCase());
  if (month === -1) return null;
  const yy = Number.parseInt(m[3], 10);
  const year = yy <= pivot ? currentCentury + yy : currentCentury - 100 + yy;
  const day = Number.parseInt(m[1], 10);
  const date = new Date(Date.UTC(year, month, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Ranking cells are plain numbers; blanks and stray dashes mean zero. */
export function parseNumber(raw: string): number {
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
}

/** The "As on 27th July, 2026" line, kept for cross-checking the dropdown date. */
function findAsOnLabel(rows: Row[]): string | null {
  for (const row of rows.slice(0, 8)) {
    const joined = row.cells.map((c) => c.text).join(" ");
    if (/as\s+on/i.test(joined)) return joined.trim();
  }
  return null;
}
