import "dotenv/config";
import mongoose from "mongoose";

/**
 * A synthetic ranked player, so the claim-and-plan flow can be walked end to
 * end without handling a real child's date of birth.
 *
 * ── Why this exists rather than "just use a real registration number" ───────
 * Claiming a ranking requires the exact date of birth of the player being
 * claimed. Every real row on that list belongs to a child, `dob` is
 * `select: false` precisely so nobody reads one casually, and testing a feature
 * is not a reason to go looking one up. This seeds a player who does not exist:
 * registration number 99999999, born 2012-05-17, ranked in Boys U-14.
 *
 * ── What it writes ─────────────────────────────────────────────────────────
 * Two documents — one snapshot, one entry — into the production database,
 * because that is the only database there is. Both are removed by `--clean`,
 * and nothing else is touched. It deliberately does NOT set `isLatestForCombo`
 * on the snapshot: the real Boys U-14 list holds that flag, and stealing it
 * would make the public rankings page render this fake row as the live list.
 *
 * Raw collection access on purpose. Importing the mongoose models would let
 * autoIndex create indexes in production as a side effect of running a script.
 *
 * USAGE
 *   npx ts-node src/scripts/seedPlannerTestPlayer.ts --seed
 *   npx ts-node src/scripts/seedPlannerTestPlayer.ts --clean
 */

const REG_NO = "99999999";
const DOB = new Date(Date.UTC(2012, 4, 17)); // 2012-05-17
const AS_ON = new Date(Date.UTC(2026, 8, 7)); // matches the current list date

const main = async () => {
  const mode = process.argv.includes("--clean")
    ? "clean"
    : process.argv.includes("--seed")
      ? "seed"
      : null;
  if (!mode) {
    console.error("Pass --seed or --clean.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI as string);
  const db = mongoose.connection.db!;
  const snapshots = db.collection("rankingsnapshots");
  const entries = db.collection("rankingentries");

  if (mode === "clean") {
    const entryResult = await entries.deleteMany({ regNo: REG_NO });
    const snapshotResult = await snapshots.deleteMany({ contentHash: `seed-${REG_NO}` });
    console.log(
      `removed ${entryResult.deletedCount} entr(ies), ${snapshotResult.deletedCount} snapshot(s)`
    );
    await mongoose.disconnect();
    return;
  }

  // Refuse to collide with a real player, however unlikely.
  const clash = await entries.findOne({ regNo: REG_NO, dob: { $exists: true } });
  if (clash && String((clash as { contentHash?: string }).contentHash) !== `seed-${REG_NO}`) {
    const existingSeed = await snapshots.findOne({ contentHash: `seed-${REG_NO}` });
    if (!existingSeed) {
      console.error(
        `Registration number ${REG_NO} already exists and was not seeded by this script. Aborting.`
      );
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  const snapshot = await snapshots.findOneAndUpdate(
    { contentHash: `seed-${REG_NO}` },
    {
      $set: {
        sportSlug: "tennis",
        federationCode: "AITA",
        category: "Boys",
        subcategory: "U-14",
        asOnDate: AS_ON,
        pdfUrl: "seed://planner-test",
        sourceUrl: "seed://planner-test",
        contentHash: `seed-${REG_NO}`,
        status: "published",
        version: 1,
        // NOT isLatestForCombo — see the note above.
        isLatestForCombo: false,
        rowCount: 1,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true, returnDocument: "after" }
  );

  const snapshotId =
    (snapshot as { _id?: unknown })?._id ??
    (await snapshots.findOne({ contentHash: `seed-${REG_NO}` }))?._id;

  await entries.updateOne(
    { regNo: REG_NO, snapshot: snapshotId },
    {
      $set: {
        snapshot: snapshotId,
        sportSlug: "tennis",
        federationCode: "AITA",
        category: "Boys",
        subcategory: "U-14",
        asOnDate: AS_ON,
        // `isLatest` IS set: the claim reads the player's current standing from
        // it, and it is scoped to this registration number, so it cannot affect
        // the real list.
        isLatest: true,
        rank: 312,
        prevRank: 330,
        regNo: REG_NO,
        givenName: "Test",
        familyName: "Player",
        fullName: "Test Player",
        nameSearch: "test player",
        dob: DOB,
        birthYear: DOB.getUTCFullYear(),
        state: "Maharashtra",
        stateCode: "MH",
        totalPoints: 148,
        // Every field below exists on real rows and is read by the public
        // player page. A raw `updateOne` bypasses mongoose's schema defaults,
        // so anything omitted here is genuinely absent rather than defaulted —
        // and `page.tsx` does `entry.points.slice(0, -1)`, which throws on an
        // undefined array and takes the whole page down with an error boundary.
        // The shape matches what the platform publishes post-cutover: a single
        // total, with no component breakdown.
        points: [{ label: "Total Pts.", value: 148 }],
        stateRank: 24,
        tournamentsPlayed: 0,
        zoneId: 4,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  console.log("Seeded a test player:");
  console.log(`  registration number : ${REG_NO}`);
  console.log(`  date of birth       : 2012-05-17`);
  console.log(`  list                : Boys U-14, rank 312`);
  console.log("\nClaim it from a child's profile, then run --clean when you are done.");
  await mongoose.disconnect();
};

void main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
