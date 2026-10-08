import type { AcceptanceSample } from "@powermysport/shared-types";

/**
 * Reads AITA's public acceptance list for one age category into numbers.
 *
 * ── What it keeps, and what it never touches ────────────────────────────────
 * The page lists children by name, state and year of birth. This reads ONLY the slot
 * ("MD-07"), the rank and the sizes, and discards the rest in the same pass. A rank with
 * no name is enough to say where a draw closed, and a stored list of children's names is
 * something this product has no reason to hold. The tests assert the output carries no
 * text at all.
 *
 * ── The shape of the page ───────────────────────────────────────────────────
 * The list is loaded by the page itself in three steps (see `AitaAcceptanceSource`): the
 * categories on offer, then one fragment per category. A category fragment holds:
 *
 *   a title      "Boys Entered-86 (Acceptance List AS On -17-08-2026)"
 *   a main draw  "Size: 64 positions (0 - MD Wild Cards, 8 - Qualifiers, 1 - Special Exempts)"
 *                then rows MD-01, MD-02 ... with the player's rank, "(Available Slot)" for
 *                a place nobody has taken, and rows for exempts and wild cards
 *   a qualifying "Size: 48 positions (4 - QD Wild Cards)" then rows QD-01 ...
 *   withdrawals  a table of players who pulled out (not read)
 *
 * Direct places in the main draw are the size less the wild cards, the qualifiers who
 * come through and the special exempts: that is what a ranked player competes for.
 */

export type ParsedCategory = Omit<
  AcceptanceSample,
  "externalId" | "startDate" | "ladder" | "ageGroup" | "gender"
> & {
  /** How many players entered the category, from the page's title. Null if it is not printed. */
  entered: number | null;
  /** The day the list was last frozen, `YYYY-MM-DD`, when the title prints one. */
  asOn: string | null;
};

export interface ListedCategory {
  categoryId: number;
  gender: "Boys" | "Girls";
  /** AITA's own code: "BS16" is boys' singles, under 16. */
  code: string;
  ageGroup: string;
}

const text = (html: string): string =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** The categories the list offers. Only singles are read: "BS16", "GS14". */
export function parseCategories(html: string): ListedCategory[] {
  const found: ListedCategory[] = [];
  const pattern = /data-gender="(\d)"[^>]*id="cat_(\d+)-tab"[^>]*>\s*([A-Z]{2}\d+)\s*</g;
  for (const match of html.matchAll(pattern)) {
    const code = match[3]!;
    if (!/^[BG]S\d{2}$/.test(code)) continue;
    found.push({
      categoryId: Number(match[2]),
      gender: code.startsWith("B") ? "Boys" : "Girls",
      code,
      ageGroup: `U-${code.slice(2)}`,
    });
  }
  return found;
}

const number = (value: string | undefined): number => (value === undefined ? 0 : Number(value));

/** "Size: 64 positions (0 - MD Wild Cards, 8 - Qualifiers, 1 - Special Exempts)". */
function drawSize(
  plain: string,
  heading: "Main Draw" | "Qualifying Draw"
): { size: number; direct: number } | null {
  const at = plain.indexOf(`${heading} - Size:`);
  if (at < 0) return null;
  const line = /Size:\s*(\d+)\s*positions\s*\(([^)]*)\)/.exec(plain.slice(at, at + 400));
  if (!line) return null;
  const size = Number(line[1]);
  const part = (label: RegExp) =>
    number(new RegExp(`(\\d+)\\s*-\\s*${label.source}`, "i").exec(line[2]!)?.[1]);
  const reserved =
    part(/(?:MD|QD)\s*Wild\s*Cards?/) + part(/Qualifiers?/) + part(/Special\s*Exempts?/);
  return { size, direct: Math.max(0, size - reserved) };
}

/** A rank from a row's rank cell, or null when the cell is "-" (an unranked player). */
const rankOf = (row: string): number | null => {
  const cell = /<td[^>]*class="[^"]*player_rank[^"]*"[^>]*>(.*?)<\/td>/s.exec(row)?.[1];
  const digits = cell ? /(\d+)\s*$/.exec(text(cell))?.[1] : undefined;
  return digits ? Number(digits) : null;
};

export function parseAcceptanceCategory(html: string): ParsedCategory | null {
  const plain = text(html);
  const main = drawSize(plain, "Main Draw");
  if (!main) return null;
  const qualifying = drawSize(plain, "Qualifying Draw") ?? { size: 0, direct: 0 };

  const mainRanks: number[] = [];
  const qualifyingRanks: number[] = [];
  let mainUnranked = 0;
  let qualifyingUnranked = 0;

  for (const row of html.split(/<tr[\s>]/).slice(1)) {
    const slot = /<td[^>]*class="[^"]*\bid\b[^"]*"[^>]*>\s*(MD|QD)-(\d+)\s*</.exec(row);
    if (!slot) continue; // wild cards, exempts, the withdrawn table
    if (/Available Slot/i.test(row)) continue; // nobody has taken this place
    const rank = rankOf(row);
    if (slot[1] === "MD") {
      if (rank === null) mainUnranked += 1;
      else mainRanks.push(rank);
    } else if (rank === null) qualifyingUnranked += 1;
    else qualifyingRanks.push(rank);
  }

  const title = /Entered-(\d+)\s*\(Acceptance List AS On\s*-?\s*(\d{2})-(\d{2})-(\d{4})\)/i.exec(
    plain
  );

  return {
    mainDrawSize: main.size,
    mainDirectSlots: main.direct,
    mainRanks: mainRanks.sort((a, b) => a - b),
    mainUnranked,
    qualifyingSize: qualifying.size,
    qualifyingDirectSlots: qualifying.direct,
    qualifyingRanks: qualifyingRanks.sort((a, b) => a - b),
    qualifyingUnranked,
    entered: title ? Number(title[1]) : null,
    asOn: title ? `${title[4]}-${title[3]}-${title[2]}` : null,
  };
}
