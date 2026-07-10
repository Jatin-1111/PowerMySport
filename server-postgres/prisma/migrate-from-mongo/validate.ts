/**
 * Post-ETL validation (run: `npm run etl:validate`).
 *
 * Compares Mongo source collection counts against the migrated Postgres tables
 * and spot-checks that normalized child rows add up. A non-zero exit means the
 * migration did not fully reconcile and should be investigated before cutover.
 */
import { MongoClient } from "mongodb";
import prisma from "../../src/lib/prisma";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error("MONGODB_URI is required for validation");

// Mongo collection -> Prisma delegate (top-level row-count parity checks).
const COUNT_CHECKS: Array<{ coll: string; model: keyof typeof prisma }> = [
  { coll: "sports", model: "sport" },
  { coll: "users", model: "user" },
  { coll: "coaches", model: "coach" },
  { coll: "venues", model: "venue" },
  { coll: "bookings", model: "booking" },
  { coll: "wallets", model: "wallet" },
  { coll: "reviews", model: "review" },
];

async function main() {
  const client = new MongoClient(MONGODB_URI!);
  await client.connect();
  const db = client.db();

  let failures = 0;
  console.log("🔎 Validating row-count parity…\n");
  for (const c of COUNT_CHECKS) {
    const mongoCount = await db.collection(c.coll).countDocuments();
    // @ts-expect-error dynamic delegate access
    const pgCount = await prisma[c.model].count();
    const ok = mongoCount === pgCount;
    if (!ok) failures++;
    console.log(
      `${ok ? "✅" : "❌"} ${c.coll.padEnd(14)} mongo=${mongoCount}  postgres=${pgCount}`,
    );
  }

  // Spot-check: embedded children were expanded (sum of Mongo array lengths ==
  // Postgres child-table row count) for a couple of representative entities.
  const users = await db.collection("users").find({}).toArray();
  const mongoAddresses = users.reduce(
    (n, u) => n + (u.addresses?.length ?? 0),
    0,
  );
  const pgAddresses = await prisma.address.count();
  const addrOk = mongoAddresses === pgAddresses;
  if (!addrOk) failures++;
  console.log(
    `\n${addrOk ? "✅" : "❌"} user addresses  mongo=${mongoAddresses}  postgres=${pgAddresses}`,
  );

  await client.close();
  await prisma.$disconnect();

  if (failures > 0) {
    console.error(`\n❌ ${failures} check(s) failed — do NOT cut over yet.`);
    process.exit(1);
  }
  console.log("\n✅ All validation checks passed.");
}

main().catch(async (e) => {
  console.error("Validation error:", e);
  await prisma.$disconnect();
  process.exit(1);
});
