/**
 * READ-ONLY report: for coaches, experts, venues and academies, how many records
 * are in each lifecycle state, and how many have a stored `lifecycle` that is
 * missing or differs from what their status fields say it should be.
 *
 * Uses the raw MongoDB driver and no Mongoose model, so it creates no collection
 * or index and writes nothing. The database is production; this only counts.
 *
 *   npx ts-node src/scripts/reportLifecycleDrift.ts
 *
 * Exit code 0 when nothing has drifted, 1 when something has.
 */
import path from "path";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import {
  LIFECYCLE_SOURCE_FIELDS,
  deriveLifecycle,
  type LifecycleKind,
} from "../shared/services/providerLifecycle";

dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const TARGETS: { kind: LifecycleKind; collection: string }[] = [
  { kind: "coach", collection: "coaches" },
  { kind: "expert", collection: "experts" },
  { kind: "venue", collection: "venues" },
  { kind: "academy", collection: "academies" },
];

const projection = (kind: LifecycleKind): Record<string, 1> =>
  Object.fromEntries(
    `lifecycle ${LIFECYCLE_SOURCE_FIELDS[kind]}`.split(" ").map((field) => [field, 1 as const])
  );

const main = async (): Promise<void> => {
  const uri = process.env.MONGO_URI || "";
  if (!/\/Powermysport(\?|$)/.test(uri)) {
    console.error("MONGO_URI must name the Powermysport database. Stopping.");
    process.exit(2);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("Powermysport");
  let drifted = 0;

  for (const { kind, collection } of TARGETS) {
    const docs = await db
      .collection(collection)
      .find({}, { projection: projection(kind) })
      .toArray();

    const states: Record<string, number> = {};
    const bad: string[] = [];
    for (const doc of docs) {
      const expected = deriveLifecycle(kind, doc);
      states[expected] = (states[expected] || 0) + 1;
      if (doc.lifecycle !== expected)
        bad.push(`${String(doc._id)} stored=${doc.lifecycle ?? "none"} expected=${expected}`);
    }

    drifted += bad.length;
    console.log(`\n${collection}: ${docs.length} records`);
    console.log(`  by state: ${JSON.stringify(states)}`);
    console.log(`  stored value missing or different: ${bad.length}`);
    for (const line of bad.slice(0, 20)) console.log(`    ${line}`);
    if (bad.length > 20) console.log(`    ... and ${bad.length - 20} more`);
  }

  await client.close();
  console.log(drifted === 0 ? "\nNo drift." : `\n${drifted} record(s) differ.`);
  process.exit(drifted === 0 ? 0 : 1);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
});
