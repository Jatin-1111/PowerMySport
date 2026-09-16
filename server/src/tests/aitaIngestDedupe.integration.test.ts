/* eslint-disable @typescript-eslint/no-var-requires */
// The bug this file exists to keep fixed.
//
// Between the August 2026 platform cutover and 2026-09-17, identity was
// `sha256(html)`. The new source generates its pages per request, so every
// fetch of an UNCHANGED list produced a different hash, the pipeline recorded a
// "correction", and wrote a complete duplicate set of rows. About 11,000
// duplicate rows per sweep, ~10MB of logical size a week, which filled a 512MB
// cluster and blocked writes across the whole platform.
//
// Identity is now `rankingDataHash(parsed.rows)`. These tests drive real
// ingests through a stub source, because the only way to prove the fix is to
// hand the pipeline two DIFFERENT renders of the SAME list and watch it decline
// to store the second.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";
// The composition sampler makes its own HTTP calls, which the stub source below
// does not implement and which say nothing about deduplication.
process.env.AITA_SKIP_COMPOSITION_SAMPLE = "true";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { card, page } = require("./fixtures/aitaPage");
const { AitaRankingIngestService } = require("../shared/services/aita/AitaRankingIngestService");
const { rankingDataHash } = require("../shared/services/aita/rankingDataHash");
const { RankingEntry } = require("../shared/models/RankingEntry");
const { RankingSnapshot } = require("../shared/models/RankingSnapshot");

let memoryServer: { getUri(): string; stop(): Promise<void> };

/** The week the shared fixture echoes, and the date it corresponds to. */
const WID = 1786300200;
const AS_ON = "2026-08-10";

const ROWS = [
  { rank: 1, playerKey: "UklBTkFONDQwMDkw", name: "Player One", points: "500.00" },
  { rank: 2, playerKey: "UklBTkFONDQwMDkx", name: "Player Two", points: "420.00" },
  { rank: 3, playerKey: "UklBTkFONDQwMDky", name: "Player Three", points: "310.00" },
];

const buildPage = (overrides: { rows?: typeof ROWS; comment?: string } = {}) => {
  const html = page((overrides.rows ?? ROWS).map((row) => card(row)));
  // Stands in for whatever actually varies between two renders of the same
  // list on the real platform. Its only job is to change the bytes, and so the
  // `contentHash`, while leaving every value the parser reads identical.
  return overrides.comment ? html.replace("<body>", `<body><!-- ${overrides.comment} -->`) : html;
};

/** A source that serves whatever HTML the test hands it, and counts fetches. */
const stubSource = (html: () => string) => ({
  listPageSize: 5000,
  fetches: 0,
  async resolveSnapshot(list: { category: string; subcategory: string }, week: { wid: number }) {
    return {
      category: list.category,
      subcategory: list.subcategory,
      asOnDate: AS_ON,
      wid: week.wid ?? WID,
      sourceUrl: "https://www.aita.hitcourt.com/ranking-view?wid=1786300200&category=BS12",
    };
  },
  async fetchList() {
    this.fetches += 1;
    const body = html();
    return { html: body, byteSize: Buffer.byteLength(body), sourceUrl: "https://example.test" };
  },
});

const ingest = (source: unknown) => new AitaRankingIngestService(source);

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await memoryServer.stop();
});

beforeEach(async () => {
  await Promise.all([RankingEntry.deleteMany({}), RankingSnapshot.deleteMany({})]);
});

describe("re-ingesting a list that has not changed", () => {
  it("stores one snapshot and one set of rows, however the page is rendered", async () => {
    let render = 0;
    const source = stubSource(() => buildPage({ comment: `render ${(render += 1)}` }));
    const service = ingest(source);

    const first = await service.ingestOne("Boys", "U-12", AS_ON);
    assert.equal(first.status, "published");

    const second = await service.ingestOne("Boys", "U-12", AS_ON);
    // The heart of it: different bytes, same list, so nothing new is written.
    assert.equal(second.status, "unchanged");
    assert.equal(second.snapshotId, first.snapshotId);

    const third = await service.ingestOne("Boys", "U-12", AS_ON);
    assert.equal(third.status, "unchanged");

    assert.equal(source.fetches, 3, "each run still fetches — only the write is skipped");
    assert.equal(await RankingSnapshot.countDocuments({}), 1);
    assert.equal(await RankingEntry.countDocuments({}), ROWS.length);
  });

  it("is not fooled by the rows arriving in a different order", async () => {
    let flipped = false;
    const source = stubSource(() => {
      const rows = flipped ? [...ROWS].reverse() : ROWS;
      flipped = true;
      return buildPage({ rows });
    });
    const service = ingest(source);

    await service.ingestOne("Boys", "U-12", AS_ON);
    const second = await service.ingestOne("Boys", "U-12", AS_ON);

    // Render order is presentation. Two pages that disagree about which of two
    // tied players prints first describe the same ranking.
    assert.equal(second.status, "unchanged");
    assert.equal(await RankingSnapshot.countDocuments({}), 1);
  });
});

describe("re-ingesting a list that really did change", () => {
  it("still records a correction, with the version bumped", async () => {
    let corrected = false;
    const source = stubSource(() => {
      const rows = corrected
        ? ROWS.map((row) => (row.rank === 2 ? { ...row, points: "455.00" } : row))
        : ROWS;
      corrected = true;
      return buildPage({ rows });
    });
    const service = ingest(source);

    const first = await service.ingestOne("Boys", "U-12", AS_ON);
    const second = await service.ingestOne("Boys", "U-12", AS_ON);

    assert.equal(first.status, "published");
    assert.equal(second.status, "published");
    assert.notEqual(second.snapshotId, first.snapshotId);

    const snapshots = await RankingSnapshot.find({}).sort({ version: 1 }).lean();
    assert.equal(snapshots.length, 2);
    assert.equal(snapshots[1].version, 2);
    // Only the newer one is live, and it is the one carrying the new points.
    assert.equal(snapshots[1].isLatestForCombo, true);
    assert.equal(snapshots[0].isLatestForCombo, false);
  });
});

describe("snapshots ingested before the fix", () => {
  it("are given a dataHash from their own rows rather than treated as a correction", async () => {
    const source = stubSource(() => buildPage({ comment: "first render" }));
    const service = ingest(source);
    await service.ingestOne("Boys", "U-12", AS_ON);

    // Exactly the state every existing snapshot is in: published, with rows,
    // and no dataHash, because it was written before the field existed.
    await RankingSnapshot.updateMany({}, { $unset: { dataHash: "" } });

    const again = await ingest(stubSource(() => buildPage({ comment: "later render" }))).ingestOne(
      "Boys",
      "U-12",
      AS_ON
    );

    // Without the backfill this returns "published" and duplicates every row,
    // which would have made the deploy itself cost one last duplicate of all
    // twelve lists.
    assert.equal(again.status, "unchanged");
    assert.equal(await RankingSnapshot.countDocuments({}), 1);
    assert.equal(await RankingEntry.countDocuments({}), ROWS.length);

    // And the hash is now stored, so the next comparison costs nothing.
    const snapshot = await RankingSnapshot.findOne({}).lean();
    assert.ok(snapshot.dataHash);
  });
});

describe("the hash itself", () => {
  const row = (over: Record<string, unknown> = {}) => ({
    regNo: "440090",
    rank: 12,
    totalPoints: 148,
    fullName: "Player One",
    stateCode: "MH",
    ...over,
  });

  it("ignores formatting the source is inconsistent about", () => {
    assert.equal(
      rankingDataHash([row()]),
      rankingDataHash([row({ totalPoints: 148.0, fullName: "  player   one ", stateCode: "mh" })])
    );
  });

  it("notices a change to any value that matters", () => {
    const base = rankingDataHash([row()]);
    assert.notEqual(base, rankingDataHash([row({ rank: 11 })]));
    assert.notEqual(base, rankingDataHash([row({ totalPoints: 149 })]));
    assert.notEqual(base, rankingDataHash([row({ fullName: "Player Onee" })]));
    assert.notEqual(base, rankingDataHash([row({ stateCode: "KA" })]));
    assert.notEqual(base, rankingDataHash([row({ regNo: "440091" })]));
  });

  it("does not depend on row order", () => {
    const a = row();
    const b = row({ regNo: "440091", rank: 13 });
    assert.equal(rankingDataHash([a, b]), rankingDataHash([b, a]));
  });
});
