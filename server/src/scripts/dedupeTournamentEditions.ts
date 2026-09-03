/**
 * One-off cleanup for duplicate TournamentEdition rows.
 *
 * Report only (safe):  npx ts-node src/scripts/dedupeTournamentEditions.ts
 * Actually delete:     npx ts-node src/scripts/dedupeTournamentEditions.ts --apply
 *
 * Why this exists: the calendar extraction prompt asks Gemini to prefix event
 * names with the organiser, which it applied inconsistently — so the same real
 * event landed twice under cosmetically different names ("Nationals (Chennai)"
 * vs "AITA Nationals (Chennai)", "AITA Rs 1 Lakh (Gudur)" vs
 * "AITA AITA Rs 1 Lakh (Gudur)"). The unique index is on
 * {sportSlug, name, startDate}, so those variants are distinct rows to Mongo.
 *
 * validateEditions() now dedupes on editionDedupKeys() so new approvals can't
 * reintroduce this, but rows already written need removing — that's this script.
 * It imports the SAME key function as the write path so the two can't drift.
 */

import "dotenv/config";
import mongoose from "mongoose";
import { TournamentEdition } from "../shared/models/TournamentEdition";
import { cleanEditionName, editionDedupKeys } from "../admin/services/DataSourceExtractionService";

const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL || "";
if (!MONGO_URI) {
  console.error("MONGO_URI not set in .env");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");

interface Row {
  _id: mongoose.Types.ObjectId;
  sportSlug: string;
  name: string;
  startDate: Date;
  endDate?: Date | null;
  registrationDeadlineDate?: Date | null;
  venue?: string | null;
  city?: string | null;
  level?: string | null;
  ageGroups?: string[];
  updatedAt?: Date;
}

/** How many useful fields a row carries — the row with the most survives. */
function completeness(r: Row): number {
  let score = 0;
  if (r.level) score += 2;
  if (r.venue) score += 1;
  if (r.city) score += 1;
  if (r.endDate) score += 1;
  if (r.registrationDeadlineDate) score += 2;
  score += Math.min(3, r.ageGroups?.length ?? 0);
  return score;
}

/** Lower is better. Flags names the extraction mangled, so the cleanest wording wins. */
function namePenalty(name: string): number {
  let penalty = 0;
  const tokens = name.trim().split(/\s+/);
  // "AITA AITA Rs 1 Lakh" — organiser prefix applied twice
  if (tokens.length >= 2 && tokens[0]!.toLowerCase() === tokens[1]!.toLowerCase()) penalty += 10;
  // "AITA CS7(Sonipat)" — missing space before the bracket
  if (/\S\(/.test(name)) penalty += 2;
  return penalty;
}

/**
 * Richest row survives (so we never drop populated fields), but it inherits the
 * best-worded name in the group — otherwise a malformed
 * "AITA AITA Rs 1 Lakh (Gudur)" that happens to carry more fields would win and
 * the clean name would be deleted along with its row.
 */
function resolveGroup(rows: Row[]): { survivor: Row; bestName: string } {
  const survivor = [...rows].sort((a, b) => {
    const byScore = completeness(b) - completeness(a);
    if (byScore !== 0) return byScore;
    return (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
  })[0]!;

  const bestName = [...rows].sort((a, b) => {
    const byPenalty = namePenalty(a.name) - namePenalty(b.name);
    if (byPenalty !== 0) return byPenalty;
    return a.name.length - b.name.length;
  })[0]!.name;

  return { survivor, bestName };
}

async function main(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  console.log(`Connected. Mode: ${APPLY ? "APPLY (will delete)" : "REPORT ONLY (no writes)"}\n`);

  const rows = (await TournamentEdition.find({})
    .select(
      "sportSlug name startDate endDate registrationDeadlineDate venue city level ageGroups updatedAt"
    )
    .lean()) as unknown as Row[];

  console.log(`Scanning ${rows.length} editions across all sports…\n`);

  // Union-find over dedup keys: two rows sharing ANY key belong to the same set.
  // (A row contributes 2 keys, so dupes can chain — e.g. bare name <-> prefixed
  // name <-> doubly-prefixed name all collapse into one group.)
  const parent = new Map<number, number>();
  const find = (i: number): number => {
    let root = i;
    while (parent.get(root) !== root) root = parent.get(root)!;
    while (parent.get(i) !== root) {
      const next = parent.get(i)!;
      parent.set(i, root);
      i = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  rows.forEach((_, i) => parent.set(i, i));
  const keyOwner = new Map<string, number>();
  rows.forEach((r, i) => {
    const iso = r.startDate.toISOString().slice(0, 10);
    for (const key of editionDedupKeys(r.name, iso)) {
      const scoped = `${r.sportSlug}|${key}`;
      const owner = keyOwner.get(scoped);
      if (owner === undefined) keyOwner.set(scoped, i);
      else union(i, owner);
    }
  });

  const groups = new Map<number, number[]>();
  rows.forEach((_, i) => {
    const root = find(i);
    const list = groups.get(root) ?? [];
    list.push(i);
    groups.set(root, list);
  });

  const toDelete: mongoose.Types.ObjectId[] = [];
  const toRename: Array<{ _id: mongoose.Types.ObjectId; from: string; to: string }> = [];
  const perSport = new Map<string, { groups: number; removed: number }>();

  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const set = members.map((i) => rows[i]!);
    const { survivor, bestName } = resolveGroup(set);
    const losers = set.filter((r) => !r._id.equals(survivor._id));

    const sport = survivor.sportSlug;
    const stat = perSport.get(sport) ?? { groups: 0, removed: 0 };
    stat.groups += 1;
    stat.removed += losers.length;
    perSport.set(sport, stat);

    console.log(`[${sport}] ${survivor.startDate.toISOString().slice(0, 10)}`);
    console.log(`   KEEP   ${survivor.name}`);
    if (bestName !== survivor.name) {
      console.log(`   RENAME -> ${bestName}`);
      toRename.push({ _id: survivor._id, from: survivor.name, to: bestName });
    }
    for (const l of losers) {
      console.log(`   REMOVE ${l.name}`);
      toDelete.push(l._id);
    }
  }

  console.log("\n─── Summary ───");
  if (perSport.size === 0) {
    console.log("No duplicates found.");
  } else {
    for (const [sport, stat] of perSport) {
      console.log(
        `  ${sport}: ${stat.removed} rows removed across ${stat.groups} duplicate groups`
      );
    }
    console.log(`  TOTAL: ${toDelete.length} of ${rows.length} editions are duplicates`);
    console.log(`  Survivors renamed to a cleaner variant: ${toRename.length}`);
  }

  // Pass 2: repair malformed names on rows that had no duplicate twin — a
  // doubled prefix like "AITA AITA Rs 1 Lakh (Belgavi)" is visible ugliness
  // whether or not the row was ever deduped.
  const deletedIds = new Set(toDelete.map((id) => id.toString()));
  const renamedIds = new Set(toRename.map((r) => r._id.toString()));
  const malformed = rows.filter((r) => {
    if (deletedIds.has(r._id.toString()) || renamedIds.has(r._id.toString())) return false;
    return cleanEditionName(r.name) !== r.name;
  });

  if (malformed.length > 0) {
    console.log("\n─── Malformed names (no duplicate twin) ───");
    for (const r of malformed) {
      console.log(`[${r.sportSlug}] ${r.name}  ->  ${cleanEditionName(r.name)}`);
    }
    console.log(`  ${malformed.length} names to repair`);
  }

  if (!APPLY) {
    console.log(
      "\nReport only — nothing was changed. Re-run with --apply to apply everything above."
    );
    await mongoose.disconnect();
    return;
  }

  if (toDelete.length > 0) {
    // Delete before renaming: a survivor may be taking a name currently held by
    // one of the rows being removed, and {sportSlug, name, startDate} is unique.
    const res = await TournamentEdition.deleteMany({ _id: { $in: toDelete } });
    console.log(`\nDeleted ${res.deletedCount} duplicate editions.`);
  }

  let renamed = 0;
  for (const r of [
    ...toRename,
    ...malformed.map((r) => ({ _id: r._id, from: r.name, to: cleanEditionName(r.name) })),
  ]) {
    try {
      await TournamentEdition.updateOne({ _id: r._id }, { $set: { name: r.to } });
      renamed++;
    } catch (err) {
      // Unique index on {sportSlug, name, startDate} — a clash means an equivalent
      // row already holds the clean name, so leave this one alone rather than fail.
      console.warn(
        `  Skipped rename "${r.from}" -> "${r.to}": ${(err as Error).message.slice(0, 120)}`
      );
    }
  }
  if (renamed > 0) console.log(`Renamed ${renamed} editions to their cleanest form.`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
