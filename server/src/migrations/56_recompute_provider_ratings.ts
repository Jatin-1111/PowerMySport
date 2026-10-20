import "dotenv/config";
import mongoose from "mongoose";

/**
 * Migration 56: recompute coach and venue ratings from the reviews the public can see.
 *
 * Until now, hiding or removing a review did not recompute the provider's
 * rating, so any provider with a moderated review may show a rating built from
 * reviews nobody can read. The code is fixed (ReviewService.moderateReview);
 * this corrects the ratings already stored.
 *
 * Only providers that have at least one hidden or removed review are looked at,
 * and only a rating that actually differs is written. A dry run prints every
 * change, so it can be read before anything is applied.
 *
 * It uses the raw collections and does NOT import the models: importing a model
 * with `autoIndex` on creates its indexes in whatever database the connection
 * points at, and a local run keys that off NODE_ENV, so even a dry run would write
 * to production (see migrations 50, 51 and 55).
 *
 * USAGE: invoke ts-node directly (PowerShell strips `--` from `npm run`).
 *
 *   npx ts-node src/migrations/56_recompute_provider_ratings.ts
 *   npx ts-node src/migrations/56_recompute_provider_ratings.ts --apply
 *
 * Re-running is idempotent. There is no --down: the previous ratings were wrong.
 */

type Db = mongoose.mongo.Db;

interface Options {
  apply?: boolean;
}

const TARGETS: Array<{ targetType: "VENUE" | "Coach"; collection: string }> = [
  { targetType: "VENUE", collection: "venues" },
  { targetType: "Coach", collection: "coaches" },
];

export const up = async (
  options: Options = {},
  db: Db = mongoose.connection.db as unknown as Db
): Promise<{ checked: number; changed: number }> => {
  const { apply = false } = options;
  let checked = 0;
  let changed = 0;

  for (const { targetType, collection } of TARGETS) {
    // Providers that have at least one review the public cannot see.
    const moderated = await db.collection("reviews").distinct("targetId", {
      targetType,
      $or: [{ isHidden: true }, { moderationStatus: "REMOVED" }],
    });

    for (const targetId of moderated) {
      checked += 1;
      const [stats] = await db
        .collection("reviews")
        .aggregate([
          {
            $match: {
              targetType,
              targetId,
              isHidden: { $ne: true },
              moderationStatus: { $ne: "REMOVED" },
            },
          },
          { $group: { _id: null, averageRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } },
        ])
        .toArray();
      const rating = stats?.averageRating || 0;
      const reviewCount = stats?.reviewCount || 0;

      const provider = await db
        .collection(collection)
        .findOne({ _id: targetId }, { projection: { rating: 1, reviewCount: 1 } });
      if (!provider) continue;

      const sameRating = Math.abs((provider.rating || 0) - rating) < 1e-9;
      if (sameRating && (provider.reviewCount || 0) === reviewCount) continue;

      changed += 1;
      console.log(
        `[update] ${targetType} ${targetId}: rating ${provider.rating ?? 0} -> ${rating.toFixed(2)}, ` +
          `reviews ${provider.reviewCount ?? 0} -> ${reviewCount}`
      );
      if (apply) {
        await db
          .collection(collection)
          .updateOne({ _id: targetId }, { $set: { rating, reviewCount } });
      }
    }
  }

  console.log(
    `${checked} provider(s) with moderated reviews checked, ${changed} ${apply ? "updated" : "would change"}.`
  );
  if (!apply) console.log("Dry run complete. Re-run with --apply.");
  return { checked, changed };
};

if (require.main === module) {
  const argv = process.argv.slice(2);
  const options: Options = { apply: argv.includes("--apply") };

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }

  void mongoose
    .connect(uri, { autoIndex: false, autoCreate: false })
    .then(async () => {
      console.log(`Target database: ${mongoose.connection.name} on ${mongoose.connection.host}`);
      await up(options);
    })
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Migration 56 failed:", error);
      process.exit(1);
    });
}
