import type { AcceptanceSample } from "@powermysport/shared-types";
import { EditionAcceptance } from "../../models/EditionAcceptance";
import type { AcceptanceRecord } from "./acceptanceCapture";

/**
 * The database side of acceptance capture, kept apart from `acceptanceCapture.ts` so that
 * the logic can be tested, and run against AITA, with no database at all.
 */

/** Tournament ids already captured, so a run fetches only what finished since. */
export async function capturedIds(): Promise<Set<string>> {
  const ids = await EditionAcceptance.distinct("externalId");
  return new Set(ids.map(String));
}

/** Insert or replace by event and category. Safe to run twice. */
export async function saveRecords(records: AcceptanceRecord[]): Promise<void> {
  if (records.length === 0) return;
  await EditionAcceptance.bulkWrite(
    records.map((record) => ({
      updateOne: {
        filter: { externalId: record.externalId, category: record.category },
        update: { $set: { ...record, capturedAt: new Date(record.capturedAt) } },
        upsert: true,
      },
    }))
  );
}

/** Past events of one kind, newest first, as the plain samples `judgeReach` reads. */
export async function samplesFor(
  ladder: string,
  ageGroup: string,
  gender: "Boys" | "Girls",
  limit = 5
): Promise<AcceptanceSample[]> {
  const rows = await EditionAcceptance.find({ ladder, ageGroup, gender })
    .sort({ startDate: -1 })
    .limit(limit)
    .lean();
  return rows.map((row) => ({
    externalId: row.externalId,
    startDate: row.startDate,
    ladder: row.ladder,
    ageGroup: row.ageGroup,
    gender: row.gender,
    mainDrawSize: row.mainDrawSize,
    mainDirectSlots: row.mainDirectSlots,
    mainRanks: row.mainRanks,
    mainUnranked: row.mainUnranked,
    qualifyingSize: row.qualifyingSize,
    qualifyingDirectSlots: row.qualifyingDirectSlots,
    qualifyingRanks: row.qualifyingRanks,
    qualifyingUnranked: row.qualifyingUnranked,
  }));
}
