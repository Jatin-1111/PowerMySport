/**
 * Migration 71: backfill `lifecycle` on coaches, experts, venues and academies.
 *
 * `lifecycle` is the one status vocabulary (Draft, Submitted, Needs information,
 * Approved, Rejected, Suspended). It is calculated from each type's existing
 * status fields by `deriveLifecycle`, and the model hooks keep it current from
 * now on. Records written before the field existed (every record today) have no
 * stored value; this fills it in from the same calculation.
 *
 * Safe by design:
 *   - Dry run by default. It prints what it would change and writes nothing.
 *   - Uses the raw MongoDB driver and no Mongoose model. The database is
 *     production, and importing a model while connected creates its collection
 *     and indexes there (autoIndex is on outside the deployed process).
 *   - Writes only `lifecycle`. The status fields that control what the public
 *     sees are never touched, and `updatedAt` is left alone.
 *   - Idempotent: a second run finds nothing to change.
 *   - Reversible: `--down` unsets the field again.
 *
 * ORDER: run this BEFORE deploying code that reads `lifecycle`. A push to master
 * deploys the server at once, so a reader that ships first would meet records
 * with no value. (Readers also fall back to the calculation, but do not rely on it.)
 *
 * USAGE (PowerShell drops a bare `--`, so call ts-node directly)
 *   npx ts-node src/migrations/71_backfill_provider_lifecycle.ts            dry run
 *   npx ts-node src/migrations/71_backfill_provider_lifecycle.ts --apply    write
 *   npx ts-node src/migrations/71_backfill_provider_lifecycle.ts --down --apply   unset
 *
 * Verify afterwards with: npm run report:lifecycle-drift
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

export interface MigrationResult {
  planned: number;
  modified: number;
  byCollection: Record<
    string,
    { records: number; toChange: number; states: Record<string, number> }
  >;
}

export const up = async (options: { apply?: boolean } = {}): Promise<MigrationResult> => {
  const apply = Boolean(options.apply);
  const uri = process.env.MONGO_URI || "";
  if (!/\/Powermysport(\?|$)/.test(uri)) {
    throw new Error("MONGO_URI must name the Powermysport database. Stopping.");
  }

  console.log(`Starting migration 71: backfill lifecycle (${apply ? "APPLY" : "DRY RUN"})...`);

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("Powermysport");

  const result: MigrationResult = { planned: 0, modified: 0, byCollection: {} };

  try {
    for (const { kind, collection } of TARGETS) {
      const docs = await db
        .collection(collection)
        .find({}, { projection: projection(kind) })
        .toArray();

      const states: Record<string, number> = {};
      const operations = [];
      for (const doc of docs) {
        const lifecycle = deriveLifecycle(kind, doc);
        states[lifecycle] = (states[lifecycle] || 0) + 1;
        if (doc.lifecycle !== lifecycle) {
          operations.push({
            updateOne: { filter: { _id: doc._id }, update: { $set: { lifecycle } } },
          });
        }
      }

      result.byCollection[collection] = {
        records: docs.length,
        toChange: operations.length,
        states,
      };
      result.planned += operations.length;

      console.log(
        `\n${collection}: ${docs.length} record(s), ${operations.length} to change. By state: ${JSON.stringify(states)}`
      );

      if (apply && operations.length > 0) {
        const written = await db
          .collection(collection)
          .bulkWrite(operations as never[], { ordered: false });
        result.modified += written.modifiedCount ?? 0;
        console.log(`  modified ${written.modifiedCount}`);
      }
    }
  } finally {
    await client.close();
  }

  console.log(`\nTo change: ${result.planned}${apply ? `, modified: ${result.modified}` : ""}`);
  if (!apply) console.log("Dry run. Nothing was written. Re-run with --apply to commit.");
  console.log("Migration 71 completed.");
  return result;
};

export const down = async (options: { apply?: boolean } = {}): Promise<number> => {
  const apply = Boolean(options.apply);
  const uri = process.env.MONGO_URI || "";
  if (!/\/Powermysport(\?|$)/.test(uri)) {
    throw new Error("MONGO_URI must name the Powermysport database. Stopping.");
  }

  console.log(`Rolling back migration 71 (${apply ? "APPLY" : "DRY RUN"})...`);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("Powermysport");
  let total = 0;
  try {
    for (const { collection } of TARGETS) {
      const filter = { lifecycle: { $exists: true } };
      const count = await db.collection(collection).countDocuments(filter);
      console.log(`${collection}: ${count} record(s) carry lifecycle.`);
      total += count;
      if (apply && count > 0) {
        const written = await db
          .collection(collection)
          .updateMany(filter, { $unset: { lifecycle: "" } });
        console.log(`  unset on ${written.modifiedCount}`);
      }
    }
  } finally {
    await client.close();
  }
  if (!apply) console.log("Dry run. Nothing was written.");
  console.log(
    "Note: the model hooks set lifecycle again on any later save or update. " +
      "A full rollback also means reverting the model change."
  );
  return total;
};

// Run if executed directly
if (require.main === module) {
  const apply = process.argv.includes("--apply");
  const rollback = process.argv.includes("--down");

  (rollback ? down({ apply }) : up({ apply }))
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Migration failed:", error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
