// Publishing a ranking week must be all-or-nothing for readers.
//
// The old publish wrote the new week's rows already marked `isLatest: true`, and
// only afterwards demoted the old week's. So the public list showed both weeks
// for the whole write, and for good if the demote step never ran, which is what a
// full cluster does to it: writes fail partway, nothing demotes, and every list
// is doubled until someone notices (2026-09-17).
//
// These tests run on a replica set, like production, so the cut-over really is a
// transaction. They check three things readers care about: the old week stays
// live until the new one is complete, a failure at any point leaves the old week
// intact, and at no instant are two weeks live, or none.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";
process.env.AITA_SKIP_COMPOSITION_SAMPLE = "true";

import assert = require("node:assert/strict");
const { after, afterEach, before, beforeEach, describe, it, mock } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

const { card, page } = require("./fixtures/aitaPage");
const { AitaRankingIngestService } = require("../shared/services/aita/AitaRankingIngestService");
const { RankingEntry } = require("../shared/models/RankingEntry");
const { RankingSnapshot } = require("../shared/models/RankingSnapshot");
const { isoDateToWid } = require("../shared/services/aita/AitaRankingSource");

let replSet: { getUri(): string; stop(): Promise<void> };

const CATEGORY = "Boys";
const SUBCATEGORY = "U-12";
const WEEK_ONE = "2026-08-03";
const WEEK_TWO = "2026-08-10";

/** `count` unique rows. Points differ per week so each week hashes differently. */
const rowsFor = (count: number, seed: number) =>
  Array.from({ length: count }, (_, i) => ({
    rank: i + 1,
    playerKey: Buffer.from(`RIANAN${440000 + i}`).toString("base64"),
    name: `Player ${i + 1}`,
    points: (1000 - i * 0.5 - seed).toFixed(2),
  }));

const buildPage = (count: number, seed: number) =>
  page(rowsFor(count, seed).map((row) => card(row)));

/** A source that serves whatever page the test hands it for the requested week. */
const stubSource = (html: (asOnDate: string) => string) => ({
  listPageSize: 5000,
  async resolveSnapshot(
    list: { category: string; subcategory: string },
    week: { asOnDate: string }
  ) {
    return {
      category: list.category,
      subcategory: list.subcategory,
      asOnDate: week.asOnDate,
      wid: isoDateToWid(week.asOnDate),
      sourceUrl: "https://www.aita.hitcourt.com/ranking-view?wid=1786300200&category=BS12",
    };
  },
  async fetchList(_list: unknown, _wid: number) {
    // The fixture always echoes one week id; the validator quarantines a page
    // whose week is not the one requested, so rewrite it to match.
    const week = this.currentWeek as string;
    const body = html(week)
      .split("1786300200")
      .join(String(isoDateToWid(week)));
    return { html: body, byteSize: Buffer.byteLength(body), sourceUrl: "https://example.test" };
  },
  currentWeek: WEEK_ONE as string,
});

const ingestWeek = (source: ReturnType<typeof stubSource>, week: string) => {
  source.currentWeek = week;
  return new AitaRankingIngestService(source).ingestOne(CATEGORY, SUBCATEGORY, week);
};

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  // Transactions need the collections to exist first.
  await RankingEntry.createCollection().catch(() => undefined);
  await RankingSnapshot.createCollection().catch(() => undefined);
});

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await Promise.all([RankingEntry.deleteMany({}), RankingSnapshot.deleteMany({})]);
});

afterEach(() => {
  mock.restoreAll();
});

/** Which snapshots currently have rows readers would see. */
const liveSnapshots = async (): Promise<string[]> =>
  (
    await RankingEntry.distinct("snapshot", {
      category: CATEGORY,
      subcategory: SUBCATEGORY,
      isLatest: true,
    })
  )
    .map(String)
    .sort();

const snapshotFor = (asOnDate: string) =>
  RankingSnapshot.findOne({
    category: CATEGORY,
    subcategory: SUBCATEGORY,
    asOnDate: new Date(asOnDate),
  }).lean();

describe("publishing a week", () => {
  it("makes the first week live", async () => {
    const source = stubSource(() => buildPage(40, 0));

    const outcome = await ingestWeek(source, WEEK_ONE);

    assert.equal(outcome.status, "published");
    assert.deepEqual(await liveSnapshots(), [outcome.snapshotId]);
    const snapshot = await snapshotFor(WEEK_ONE);
    assert.equal(snapshot.status, "published");
    assert.equal(snapshot.isLatestForCombo, true);
    assert.equal(await RankingEntry.countDocuments({ isLatest: true }), 40);
  });

  it("replaces the live week with the new one, and leaves exactly one week live", async () => {
    const source = stubSource((week) => buildPage(40, week === WEEK_ONE ? 0 : 7));
    const first = await ingestWeek(source, WEEK_ONE);

    const second = await ingestWeek(source, WEEK_TWO);

    assert.equal(second.status, "published");
    assert.deepEqual(await liveSnapshots(), [second.snapshotId], "only the new week is live");
    assert.equal((await snapshotFor(WEEK_ONE)).isLatestForCombo, false);
    assert.equal((await snapshotFor(WEEK_TWO)).isLatestForCombo, true);
    // The old week's rows are kept, as history, just not live.
    assert.equal(await RankingEntry.countDocuments({ snapshot: first.snapshotId }), 40);
    assert.equal(
      await RankingEntry.countDocuments({ snapshot: first.snapshotId, isLatest: true }),
      0
    );
  });

  it("does not let a backfilled older week take over from a newer one", async () => {
    const source = stubSource((week) => buildPage(40, week === WEEK_TWO ? 7 : 3));
    const newer = await ingestWeek(source, WEEK_TWO);

    const older = await ingestWeek(source, WEEK_ONE);

    assert.equal(older.status, "published");
    assert.deepEqual(await liveSnapshots(), [newer.snapshotId], "the newer week stays live");
    assert.equal((await snapshotFor(WEEK_ONE)).isLatestForCombo, false);
  });
});

describe("when publishing fails", () => {
  it("leaves the old week live and shows nothing of the new one if writing its rows fails part-way", async () => {
    const source = stubSource((week) => buildPage(1200, week === WEEK_ONE ? 0 : 7));
    const first = await ingestWeek(source, WEEK_ONE);

    // The cluster fills up after the first 500-row chunk of the new week.
    const original = RankingEntry.bulkWrite.bind(RankingEntry);
    let calls = 0;
    mock.method(RankingEntry, "bulkWrite", async (...args: unknown[]) => {
      calls += 1;
      if (calls === 2) throw new Error("you are over your space quota");
      return original(...args);
    });

    await assert.rejects(() => ingestWeek(source, WEEK_TWO), /space quota/);

    assert.deepEqual(
      await liveSnapshots(),
      [first.snapshotId],
      "readers still see the old week, alone"
    );
    const second = await snapshotFor(WEEK_TWO);
    assert.notEqual(second?.status, "published");
    assert.equal(
      await RankingEntry.countDocuments({ snapshot: second?._id, isLatest: true }),
      0,
      "none of the new week's rows are live"
    );
    assert.equal(
      await RankingEntry.countDocuments({ snapshot: second?._id }),
      0,
      "the half-written rows are removed, so a full cluster is not left holding them"
    );
  });

  it("leaves the old week live if the cut-over itself fails, with nothing half-flipped", async () => {
    const source = stubSource((week) => buildPage(60, week === WEEK_ONE ? 0 : 7));
    const first = await ingestWeek(source, WEEK_ONE);

    // The very last step of the cut-over fails, after the flags have been changed
    // inside the transaction. Atomic means none of that may be visible.
    const original = RankingSnapshot.updateOne.bind(RankingSnapshot);
    mock.method(
      RankingSnapshot,
      "updateOne",
      async (filter: unknown, update: any, ...rest: unknown[]) => {
        if (update?.$set?.status === "published") throw new Error("connection reset");
        return original(filter, update, ...rest);
      }
    );

    await assert.rejects(() => ingestWeek(source, WEEK_TWO), /connection reset/);

    assert.deepEqual(
      await liveSnapshots(),
      [first.snapshotId],
      "the old week is still the only live one"
    );
    assert.equal(
      await RankingEntry.countDocuments({ snapshot: first.snapshotId, isLatest: true }),
      60
    );
    assert.equal(
      (await snapshotFor(WEEK_ONE)).isLatestForCombo,
      true,
      "and still the latest snapshot"
    );
    const second = await snapshotFor(WEEK_TWO);
    assert.notEqual(second.status, "published");
    assert.equal(await RankingEntry.countDocuments({ snapshot: second._id, isLatest: true }), 0);
  });

  it("publishes cleanly when retried, with one set of rows and no duplicates", async () => {
    const source = stubSource((week) => buildPage(1200, week === WEEK_ONE ? 0 : 7));
    await ingestWeek(source, WEEK_ONE);
    const original = RankingEntry.bulkWrite.bind(RankingEntry);
    let calls = 0;
    mock.method(RankingEntry, "bulkWrite", async (...args: unknown[]) => {
      calls += 1;
      if (calls === 2) throw new Error("you are over your space quota");
      return original(...args);
    });
    await assert.rejects(() => ingestWeek(source, WEEK_TWO), /space quota/);
    mock.restoreAll();

    const retried = await ingestWeek(source, WEEK_TWO);

    assert.equal(retried.status, "published");
    assert.deepEqual(await liveSnapshots(), [retried.snapshotId]);
    assert.equal(await RankingEntry.countDocuments({ snapshot: retried.snapshotId }), 1200);
    assert.equal(
      await RankingSnapshot.countDocuments({ asOnDate: new Date(WEEK_TWO) }),
      1,
      "one snapshot"
    );
  });
});

describe("what a reader sees while a publish runs", () => {
  it("is never two live weeks, and never none", async () => {
    const source = stubSource((week) => buildPage(1200, week === WEEK_ONE ? 0 : 7));
    await ingestWeek(source, WEEK_ONE);

    const seen = new Set<number>();
    let publishing = true;
    const watcher = (async () => {
      while (publishing) {
        seen.add((await liveSnapshots()).length);
      }
    })();

    await ingestWeek(source, WEEK_TWO);
    publishing = false;
    await watcher;
    seen.add((await liveSnapshots()).length);

    assert.ok(seen.has(1), "the list was always readable");
    assert.ok(!seen.has(2), `two weeks were live at once (saw ${[...seen].sort().join(",")})`);
    assert.ok(!seen.has(0), `no week was live at some instant (saw ${[...seen].sort().join(",")})`);
  });
});
