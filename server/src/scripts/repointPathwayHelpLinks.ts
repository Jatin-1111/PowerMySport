/**
 * Bring stored pathway links in line with the routes that actually exist.
 *
 *   npx tsx -r dotenv/config src/scripts/repointPathwayHelpLinks.ts --dry
 *   npx tsx -r dotenv/config src/scripts/repointPathwayHelpLinks.ts
 *
 * Two changes, both of them things the seed script cannot do for a guide that is
 * already in the database:
 *
 *   1. `/academies`, `/coaches`, `/venues` and `/experts` were standalone
 *      directories. They are gone; /booking's tabs are the one discovery
 *      surface, and each of those paths now 308s to its tab.
 *   2. The "Find tournament" chip is dropped entirely — `/tournaments` has no
 *      index page, and the tournament calendar is reached from the federation
 *      band on the same page.
 *
 * Rewrites only `helpLinks` and `primaryAction.href`. Re-running the full seed
 * would also rewrite every question, signal and decision, discarding anything
 * edited in the CMS since — a far bigger promise than this needs to make.
 *
 * Idempotent: a second run reports nothing to change.
 */

import mongoose from "mongoose";

/** Old href → new href. */
const REPOINT: Record<string, string> = {
  "/academies": "/booking?tab=academies",
  "/coaches": "/booking?tab=coaches",
  "/venues": "/booking?tab=venues",
  "/experts": "/booking?tab=experts",
};

/** helpLinks chips to delete outright, matched on href prefix. */
const DROP_CHIP_HREFS = ["/tournaments", "/federations/aita?tab=calendar"];

/** …but only when the chip is the tournament one. Labels vary less than hrefs. */
const DROP_CHIP_LABELS = ["find tournament"];

interface StoredAction {
  label: string;
  href?: string;
}

interface StoredStage {
  key: string;
  helpLinks?: StoredAction[];
  primaryAction?: StoredAction;
}

const shouldDropChip = (link: StoredAction): boolean =>
  DROP_CHIP_LABELS.includes(link.label.trim().toLowerCase()) &&
  DROP_CHIP_HREFS.some((href) => (link.href ?? "").startsWith(href));

const repoint = (href: string | undefined): string | undefined =>
  href && REPOINT[href] ? REPOINT[href] : href;

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry");
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI is not set.");

  await mongoose.connect(uri);
  try {
    const collection = mongoose.connection.collection("pathwayguides");
    const guides = await collection
      .find({}, { projection: { sportSlug: 1, stages: 1 } })
      .toArray();

    let changedGuides = 0;

    for (const guide of guides) {
      const stages = (guide.stages ?? []) as StoredStage[];
      let dropped = 0;
      let repointed = 0;

      const patched = stages.map((stage) => {
        const helpLinks = (stage.helpLinks ?? []).filter((link) => {
          if (shouldDropChip(link)) {
            dropped += 1;
            return false;
          }
          return true;
        });

        const nextHelpLinks = helpLinks.map((link) => {
          const href = repoint(link.href);
          if (href !== link.href) repointed += 1;
          return href === link.href ? link : { ...link, href };
        });

        const primaryHref = repoint(stage.primaryAction?.href);
        const primaryChanged =
          stage.primaryAction && primaryHref !== stage.primaryAction.href;
        if (primaryChanged) repointed += 1;

        return {
          ...stage,
          ...(stage.helpLinks ? { helpLinks: nextHelpLinks } : {}),
          ...(primaryChanged && stage.primaryAction
            ? { primaryAction: { ...stage.primaryAction, href: primaryHref } }
            : {}),
        };
      });

      if (dropped === 0 && repointed === 0) continue;

      console.log(
        `  ${guide.sportSlug}: dropped ${dropped} chip(s), repointed ${repointed} link(s)`,
      );
      changedGuides += 1;

      if (!dryRun) {
        await collection.updateOne(
          { _id: guide._id },
          { $set: { stages: patched } },
        );
      }
    }

    if (changedGuides === 0) {
      console.log("Nothing to change.");
    } else {
      console.log(
        dryRun
          ? `\n--dry: ${changedGuides} guide(s) would be updated, nothing written.`
          : `\nUpdated ${changedGuides} guide(s).`,
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
