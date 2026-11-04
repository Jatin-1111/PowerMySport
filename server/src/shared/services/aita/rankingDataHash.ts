import { createHash } from "crypto";

/**
 * The identity of a ranking list: a hash of what it *says*, not of the bytes it
 * arrived in.
 *
 * ── The bug this exists to end ───────────────────────────────────────────────
 * Identity used to be `sha256(html)`. That was exactly right while the source
 * served static PDFs: same file, same bytes, same hash. After AITA moved to the
 * hitcourt platform in August 2026 the page is generated per request, and
 * something in the markup differs every time — so every fetch of an unchanged
 * list produced a new hash, the pipeline correctly concluded "the content
 * changed, this must be a correction", bumped the version and wrote a complete
 * duplicate set of rows.
 *
 * Measured on 2026-09-17: Boys U-14 for 2026-08-31 existed as v1, v2 and v3,
 * two of them fetched one minute apart, with 1,697 rows each and not a single
 * differing value. Roughly 11,000 duplicate rows per sweep, about 10 MB of
 * logical size a week, which is what filled a 512 MB cluster and blocked writes
 * platform-wide.
 *
 * ── Why these five fields ────────────────────────────────────────────────────
 * They are the ones that carry meaning and that exist identically on both sides
 * of the comparison: a freshly parsed row, and a row already stored in
 * `RankingEntry`. That symmetry is the whole point — it lets an old snapshot be
 * given a `dataHash` after the fact by re-hashing the rows we kept, so the
 * changeover does not itself produce one last duplicate of every list.
 *
 * Anything derived is deliberately excluded. `prevRank` and `stateRank` are
 * computed by us at publish time rather than read from the source, so including
 * them would make a list's identity depend on what we happened to hold when we
 * ingested it.
 *
 * ── Why the rows are sorted ──────────────────────────────────────────────────
 * The order the page happens to render ties in is presentation, not data. Two
 * renders that disagree about which of two tied players prints first describe
 * the same ranking, and a hash that called them different lists would put us
 * straight back into duplicating on every sweep.
 */
export interface HashableRankingRow {
  regNo: string;
  rank: number;
  totalPoints: number;
  fullName: string;
  stateCode?: string | null;
}

/** One row, reduced to the values that would make it a genuinely different list. */
const canonicalise = (row: HashableRankingRow): string =>
  [
    String(row.regNo ?? "").trim(),
    row.rank,
    // Fixed to two places so 500 and 500.00 are one number rather than two
    // strings. The source prints both forms for the same value.
    Number(row.totalPoints ?? 0).toFixed(2),
    String(row.fullName ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " "),
    String(row.stateCode ?? "")
      .trim()
      .toUpperCase(),
  ].join("|");

export const rankingDataHash = (rows: HashableRankingRow[]): string => {
  const canonical = rows.map(canonicalise).sort().join("\n");
  return createHash("sha256").update(canonical).digest("hex");
};
