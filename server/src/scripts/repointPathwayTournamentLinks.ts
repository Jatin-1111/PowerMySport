/**
 * Repoint pathway links that still target the dead `/tournaments` route.
 *
 *   npx tsx -r dotenv/config src/scripts/repointPathwayTournamentLinks.ts --dry
 *   npx tsx -r dotenv/config src/scripts/repointPathwayTournamentLinks.ts
 *
 * `/tournaments` only ever had a `[slug]` detail page — the bare path 404s — but
 * it is baked into stored guide content as a `helpLinks` chip on every stage and
 * as one stage's `primaryAction`. Fixing the seed script alone doesn't help: the
 * guide in the database was written before that edit.
 *
 * Rewrites ONLY those href values. Re-running the full seed would also rewrite
 * every question, signal and decision, discarding anything edited in the CMS
 * since it last ran — a much bigger promise than this change needs to make.
 *
 * Idempotent: a second run finds nothing left to change. Sports with no calendar
 * mapped are reported and skipped rather than pointed somewhere wrong.
 */

import mongoose from "mongoose";

const DEAD_HREF = "/tournaments";

/**
 * Where each sport's tournament calendar actually lives. The federation calendar
 * tab lists every dated edition we hold for the sport, not only that body's own
 * events, so it is the real replacement for a tournaments index.
 */
const CALENDAR_BY_SPORT: Record<string, string> = {
  tennis: "/federations/aita?tab=calendar",
  badminton: "/federations/bai?tab=calendar",
};

interface StoredAction {
  label: string;
  href?: string;
}

interface StoredStage {
  key: string;
  helpLinks?: StoredAction[];
  primaryAction?: StoredAction;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry");
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI is not set.");

  await mongoose.connect(uri);
  try {
    const collection = mongoose.connection.collection("pathwayguides");
    const guides = await collection.find({}, { projection: { sportSlug: 1, stages: 1 } }).toArray();

    let changedGuides = 0;

    for (const guide of guides) {
      const sportSlug = String(guide.sportSlug);
      const stages = (guide.stages ?? []) as StoredStage[];

      const hits = stages.reduce(
        (count, stage) =>
          count +
          (stage.helpLinks ?? []).filter((l) => l.href === DEAD_HREF).length +
          (stage.primaryAction?.href === DEAD_HREF ? 1 : 0),
        0
      );

      if (hits === 0) continue;

      const replacement = CALENDAR_BY_SPORT[sportSlug];
      if (!replacement) {
        console.warn(`  ${sportSlug}: ${hits} dead link(s) but no calendar mapped — skipped.`);
        continue;
      }

      const patched = stages.map((stage) => ({
        ...stage,
        ...(stage.helpLinks
          ? {
              helpLinks: stage.helpLinks.map((link) =>
                link.href === DEAD_HREF ? { ...link, href: replacement } : link
              ),
            }
          : {}),
        ...(stage.primaryAction?.href === DEAD_HREF
          ? { primaryAction: { ...stage.primaryAction, href: replacement } }
          : {}),
      }));

      console.log(`  ${sportSlug}: ${hits} link(s) → ${replacement}`);
      changedGuides += 1;

      if (!dryRun) {
        await collection.updateOne({ _id: guide._id }, { $set: { stages: patched } });
      }
    }

    if (changedGuides === 0) {
      console.log("Nothing to change.");
    } else {
      console.log(
        dryRun
          ? `\n--dry: ${changedGuides} guide(s) would be updated, nothing written.`
          : `\nUpdated ${changedGuides} guide(s).`
      );
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
