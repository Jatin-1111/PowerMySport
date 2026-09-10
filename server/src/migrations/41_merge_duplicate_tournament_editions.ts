import "dotenv/config";
import mongoose from "mongoose";
import { TournamentEdition } from "../shared/models/TournamentEdition";

/**
 * Migration 41: point duplicate TournamentEdition rows at a single survivor.
 *
 * Two extraction passes wrote the same real event under different `name`
 * values — a full official title and a short calendar title:
 *
 *   1st KCA International FIDE Rating Open Chess Tournament (Odisha)
 *   1st KCA International Open (Odisha)
 *
 * The unique index on (sportSlug, name, startDate) cannot see these as the same
 * row, because the names genuinely differ. Each therefore got its own slug and
 * its own public page. In Search Console 27% of tournament impressions land on
 * an event indexed under two URLs, splitting ranking signals and letting the
 * weaker title win the impression — one pair drew 613 impressions/1 click on
 * one URL and 283/5 on the other.
 *
 * MATCHING IS DELIBERATELY CONSERVATIVE. Same sport, same start date, and one
 * name's word set must be a strict subset of the other's. Sibling events share
 * a date and most of a name but each carries a word the other lacks — "Cat A
 * (above 2100)" vs "Cat B (below 2100)", "Blitz" vs "Rapid" — so neither is a
 * subset of the other and they are left alone. The cost of that strictness is
 * missed duplicates, which is the right way to be wrong here: a missed pair
 * stays as it is today, whereas a wrong merge redirects a real tournament's
 * page to a different tournament.
 *
 * Losers are NOT deleted. They keep their row and gain `mergedInto`, so
 * /tournaments/[slug] answers the old URL with a permanent redirect and hands
 * the accumulated search equity to the survivor. Deleting them would 404 URLs
 * that currently carry ~1,435 impressions a quarter.
 *
 * This treats the symptom. The extraction pass that produces two names for one
 * event is the cause, and until that is fixed new duplicates will keep arriving
 * — re-running this is how you sweep them up.
 *
 * Idempotent: rows that already carry `mergedInto` are skipped, and a second
 * run finds nothing new.
 *
 * REVERSIBLE. `down` unsets `mergedInto` everywhere, restoring both pages.
 *
 * USAGE
 *   npm run migrate:merge-dupe-editions              # dry run (default)
 *   npm run migrate:merge-dupe-editions -- --apply   # write mergedInto
 *   npm run migrate:merge-dupe-editions -- --down    # undo
 */

interface Options {
  apply?: boolean;
}

interface Row {
  _id: mongoose.Types.ObjectId;
  slug?: string;
  name: string;
  sportSlug: string;
  startDate: Date;
  documents?: unknown[];
  detailUrl?: string;
  officialName?: string;
  organiser?: string;
  venue?: string;
  city?: string;
  level?: string;
  ageGroups?: string[];
  mergedInto?: string;
  createdAt: Date;
}

/**
 * Words that carry no distinguishing meaning between two spellings of the same
 * event. Kept short on purpose — every word removed here is a word that can no
 * longer tell two different events apart.
 */
const NOISE = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "at",
  "in",
  "for",
  "fide",
  "rated",
  "rating",
  "chess",
  "tournament",
  "tournaments",
  "championship",
  "championships",
]);

/**
 * Qualifiers that split one festival into several separately-entered events.
 *
 * These are compared for EXACT equality before two rows are considered the same
 * event, and this is the guard that does the real work. A first attempt matched
 * on word-subset alone with "chess"/"tournament" treated as noise, which made
 * "Athens of the East 6th International Grandmaster Open Chess Tournament" a
 * subset of "…Open Cat D Below 1800" and proposed merging a category into the
 * umbrella listing. They run on the same day under near-identical names and are
 * different competitions with different entry fees and draws.
 */
const FORMATS = new Set(["blitz", "rapid", "classical", "bullet"]);
const DIVISIONS = new Set([
  "junior",
  "juniors",
  "senior",
  "seniors",
  "subjunior",
  "boys",
  "girls",
  "men",
  "mens",
  "women",
  "womens",
  "masters",
  "challengers",
  "veterans",
  "team",
  "teams",
  "mixed",
  "gm",
  "im",
  "wgm",
  "wim",
]);
const PLURAL: Record<string, string> = {
  juniors: "junior",
  seniors: "senior",
  teams: "team",
  mens: "men",
  womens: "women",
};

function discriminators(name: string): Set<string> {
  const text = (name || "").toLowerCase();
  const out = new Set<string>();

  // "Cat B", "Cat-E", "(Category - A Above 2100)"
  for (const m of text.matchAll(/\bcat(?:egory)?\b[\s\-'"]*([a-e])\b/g)) out.add(`cat${m[1]}`);
  // Rating bands are 3-4 digits ("below 1700"); 1-2 digits is an age group.
  for (const m of text.matchAll(/\b(below|above|under)\s*-?\s*(\d{3,4})\b/g))
    out.add(`${m[1] === "under" ? "below" : m[1]}${m[2]}`);
  // Age groups: "U-14", "Under 14".
  for (const m of text.matchAll(/\b(?:u|under)\s*-?\s*(\d{1,2})\b/g)) out.add(`u${m[1]}`);

  for (const raw of text.split(/[^a-z0-9]+/)) {
    if (!raw) continue;
    const w = PLURAL[raw] ?? raw;
    if (FORMATS.has(w) || DIVISIONS.has(w)) out.add(w);
  }
  return out;
}

function coreWords(name: string, year?: number): Set<string> {
  const out = new Set<string>();
  const disc = discriminators(name);
  for (const raw of (name || "").toLowerCase().split(/[^a-z0-9]+/)) {
    if (!raw) continue;
    const w = PLURAL[raw] ?? raw;
    if (NOISE.has(w) || disc.has(w)) continue;
    // "…Chess Tournament 2026" and "…Hyderabad" are the same event: rows are
    // already bucketed by exact start date, so the edition year distinguishes
    // nothing and only defeats the subset test. Matched against this row's own
    // year rather than any 4-digit number, so a rating band like "2000" that
    // reached here without its "above"/"below" is still treated as meaningful.
    if (year && w === String(year)) continue;
    // The bare parts of a qualifier ("cat", "b", "below", "1700") are already
    // represented in the discriminator set; leaving them here too would let a
    // stray letter defeat the subset test.
    if (/^(cat|category|categories|below|above|under)$/.test(w)) continue;
    if (/^[a-e]$/.test(w) && disc.size > 0) continue;
    if (/^\d{1,4}$/.test(w) && [...disc].some((d) => d.endsWith(w))) continue;
    out.add(w);
  }
  return out;
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function isSubset(small: Set<string>, big: Set<string>): boolean {
  for (const w of small) if (!big.has(w)) return false;
  return true;
}

/** Same event iff they split the festival the same way AND one name refines the other. */
export function isSameEvent(a: string, b: string, year?: number): boolean {
  if (!sameSet(discriminators(a), discriminators(b))) return false;
  const aw = coreWords(a, year);
  const bw = coreWords(b, year);
  if (aw.size === 0 || bw.size === 0) return false;
  return isSubset(aw, bw) || isSubset(bw, aw);
}

/** How much a row is actually worth keeping as the public page. */
function completeness(r: Row): number {
  let score = 0;
  score += (r.documents?.length ?? 0) * 10;
  if (r.detailUrl) score += 5;
  if (r.officialName) score += 2;
  if (r.organiser) score += 2;
  if (r.venue) score += 2;
  if (r.city) score += 1;
  if (r.level) score += 1;
  if (r.ageGroups?.length) score += 1;
  return score;
}

function dayKey(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(
    `Starting migration 41: merge duplicate tournament editions (${apply ? "APPLY" : "DRY RUN"})...`
  );

  const rows = (await TournamentEdition.find({ slug: { $exists: true, $ne: null } })
    .select(
      "slug name sportSlug startDate documents detailUrl officialName organiser venue city level ageGroups mergedInto createdAt"
    )
    .lean()) as unknown as Row[];

  console.log(`  scanned ${rows.length} edition(s) with a slug.`);

  // Only rows sharing a sport and a start date can possibly be the same event.
  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    if (r.mergedInto) continue; // already merged by an earlier run
    const key = `${r.sportSlug}|${dayKey(r.startDate)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(r);
  }

  const merges: { survivor: Row; loser: Row }[] = [];
  const claimed = new Set<string>();

  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;
    // Richest first, so the survivor of a group is settled before its losers
    // are considered — that keeps a 3-way group collapsing onto one row rather
    // than forming a chain of redirects.
    const year = new Date(bucket[0]!.startDate).getUTCFullYear();
    const ranked = [...bucket].sort(
      (a, b) =>
        completeness(b) - completeness(a) ||
        coreWords(b.name, year).size - coreWords(a.name, year).size ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (let i = 0; i < ranked.length; i++) {
      const survivor = ranked[i]!;
      if (claimed.has(String(survivor._id))) continue;

      for (let j = i + 1; j < ranked.length; j++) {
        const loser = ranked[j]!;
        if (claimed.has(String(loser._id))) continue;
        if (!isSameEvent(survivor.name, loser.name, year)) continue;
        claimed.add(String(loser._id));
        merges.push({ survivor, loser });
      }
    }
  }

  if (merges.length === 0) {
    console.log("  no new duplicate editions found.");
    await flattenChains(apply);
    return;
  }

  const survivors = new Set(merges.map((m) => String(m.survivor._id)));
  console.log(`  found ${merges.length} duplicate row(s) across ${survivors.size} event(s).\n`);

  for (const m of merges) {
    console.log(`  KEEP  ${m.survivor.slug}`);
    console.log(`        "${m.survivor.name}"  [completeness ${completeness(m.survivor)}]`);
    console.log(`  ->    ${m.loser.slug}`);
    console.log(`        "${m.loser.name}"  [completeness ${completeness(m.loser)}]\n`);
  }

  if (!apply) {
    console.log(
      `Dry run complete — ${merges.length} row(s) would gain mergedInto. Re-run with --apply.`
    );
    return;
  }

  let written = 0;
  for (const m of merges) {
    if (!m.survivor.slug) continue;
    await TournamentEdition.updateOne(
      { _id: m.loser._id },
      { $set: { mergedInto: m.survivor.slug } }
    );
    written++;
  }

  console.log(`  set mergedInto on ${written} row(s).`);
  await flattenChains(apply);
  console.log("Migration 41 complete.");
};

/**
 * Collapse A -> B -> C into A -> C.
 *
 * A row that survived one run can be merged away by a later one — a widened
 * matcher finds a partner it previously missed — and every row already pointing
 * at it is then aiming at a URL that itself redirects. Browsers follow the hop,
 * but each one bleeds ranking signal and Google gives up after a handful, so
 * the thing this migration exists to preserve is exactly what a chain leaks.
 *
 * Runs on every invocation rather than only after new merges, so re-running is
 * how an existing chain gets repaired.
 */
async function flattenChains(apply: boolean): Promise<void> {
  const merged = (await TournamentEdition.find({ mergedInto: { $exists: true, $ne: null } })
    .select("slug mergedInto")
    .lean()) as unknown as { slug: string; mergedInto: string }[];

  const target = new Map(merged.map((m) => [m.slug, m.mergedInto]));
  const fixes: { slug: string; from: string; to: string }[] = [];

  for (const row of merged) {
    let terminal = row.mergedInto;
    const seen = new Set<string>([row.slug]);
    while (target.has(terminal) && !seen.has(terminal)) {
      seen.add(terminal);
      terminal = target.get(terminal)!;
    }
    // A cycle cannot be resolved by following it; leave it and say so.
    if (seen.has(terminal) && terminal !== row.mergedInto) {
      console.log(`  ! cycle involving ${row.slug} — left untouched, needs a look`);
      continue;
    }
    if (terminal !== row.mergedInto)
      fixes.push({ slug: row.slug, from: row.mergedInto, to: terminal });
  }

  if (fixes.length === 0) {
    console.log("  no redirect chains to flatten.");
    return;
  }

  console.log(`  ${fixes.length} chained redirect(s) to flatten:`);
  for (const f of fixes) console.log(`    ${f.slug}\n      ${f.from} -> ${f.to}`);

  if (!apply) {
    console.log("  (dry run — not written)");
    return;
  }

  for (const f of fixes) {
    await TournamentEdition.updateOne({ slug: f.slug }, { $set: { mergedInto: f.to } });
  }
  console.log(`  flattened ${fixes.length} chain(s).`);
}

export const down = async () => {
  console.log("Reverting migration 41: clearing mergedInto...");
  const result = await TournamentEdition.updateMany(
    { mergedInto: { $exists: true } },
    { $unset: { mergedInto: "" } }
  );
  console.log(`  cleared mergedInto on ${result.modifiedCount} row(s).`);
};

const isDirectRun = require.main === module;

if (isDirectRun) {
  const argv = process.argv.slice(2);
  const options: Options = { apply: argv.includes("--apply") };
  const isDown = argv.includes("--down");

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }

  void mongoose
    .connect(uri)
    .then(() => (isDown ? down() : up(options)))
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Migration 41 failed:", error);
      process.exit(1);
    });
}
