/* eslint-disable @typescript-eslint/no-var-requires */
// The sweep end to end against a real (in-memory) MongoDB and a stub AITA.
//
// What is pinned here is what could do damage on a schedule nobody is watching:
// a report writes nothing, a second sweep changes nothing it did not have to, an
// event is cancelled only after it has been missing long enough and never because
// a page was half-read, a fact sheet that fails to load does not replace real
// figures with the rules' version of them, and a failed backup stops the writes.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { syncAitaCalendar } = require("../shared/services/aita/AitaCalendarSyncService");
const { parseMonthPage, parseFactSheet } = require("../shared/services/aita/calendarParser");
const { MONTH_PAGE, FACT_SHEET } = require("./fixtures/aitaCalendar");

let memoryServer: { getUri(): string; stop(): Promise<void> };
const col = () => mongoose.connection.db.collection("tournamenteditions");

const NOW = new Date("2026-10-06T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

const fixtureRows = parseMonthPage(MONTH_PAGE);
const byId = (id: string) => ({
  ...fixtureRows.find((r: { externalId: string }) => r.externalId === id),
});
const TS = byId("3016"); // Talent Series, Bengaluru, 2026-10-31
const CS = byId("3011"); // Championship Series, Lucknow, 2026-10-31
const NS = byId("2934"); // National Series, Sonipat, 2026-11-14

interface Stub {
  october: unknown[];
  november: unknown[];
  failMonth?: boolean;
  failSheets?: boolean;
  sheetFetches: number;
}
const stubSource = (stub: Stub) => ({
  async fetchMonth(_year: number, month: number) {
    if (stub.failMonth) throw new Error("GET month returned 503");
    return {
      sourceUrl: `https://stub.test/month-${month}`,
      rows: month === 10 ? stub.october : stub.november,
    };
  },
  async fetchFactSheet() {
    stub.sheetFetches += 1;
    if (stub.failSheets) throw new Error("GET sheet returned 503");
    return parseFactSheet(FACT_SHEET);
  },
});

const sweep = (stub: Stub, options: Record<string, unknown> = {}) =>
  syncAitaCalendar(
    { db: mongoose.connection.db, source: stubSource(stub) },
    { apply: true, months: 2, now: NOW, ...options }
  );

let stub: Stub;
beforeEach(async () => {
  await col().deleteMany({});
  stub = { october: [TS, CS], november: [NS], sheetFetches: 0 };
});

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
});
after(async () => {
  await mongoose.disconnect();
  await memoryServer.stop();
});

describe("syncAitaCalendar", () => {
  it("writes nothing when asked only to report", async () => {
    const report = await sweep(stub, { apply: false });
    assert.equal(report.applied, false);
    assert.equal(report.plan.creates.length, 3);
    assert.equal(await col().countDocuments(), 0);
  });

  it("creates the events, and a second sweep creates nothing and matches by AITA id", async () => {
    const first = await sweep(stub);
    assert.equal(first.written.created, 3);
    assert.equal(await col().countDocuments(), 3);

    const second = await sweep(stub);
    assert.equal(second.written.created, 0);
    assert.equal(second.plan.updates.length, 3);
    assert.ok(
      second.plan.updates.every((u: { matchedBy: string }) => u.matchedBy === "externalId")
    );
    assert.equal(await col().countDocuments(), 3);
  });

  it("updates an old row in place and keeps its name, slug and curated fields", async () => {
    await col().insertOne({
      sportSlug: "tennis",
      name: "AITA CS7 (Lucknow)",
      slug: "aita-cs7-lucknow-2026-11-02",
      startDate: new Date("2026-11-02T00:00:00.000Z"),
      city: "Lucknow",
      ladder: "Championship Series",
      kind: "junior-ladder",
      venue: "A curated venue",
      status: "announced",
      lastCheckedAt: new Date("2026-08-08T00:00:00.000Z"),
    });
    await sweep(stub);
    const row = await col().findOne({ slug: "aita-cs7-lucknow-2026-11-02" });
    assert.equal(row.name, "AITA CS7 (Lucknow)");
    assert.equal(row.venue, "A curated venue");
    assert.equal(row.externalId, "3011");
    assert.equal(row.startDate.toISOString(), "2026-10-31T00:00:00.000Z");
    assert.equal(await col().countDocuments({ city: "Lucknow" }), 1);
  });

  it("keeps fact-sheet details when the sheet cannot be read next time", async () => {
    await sweep(stub);
    const before = await col().findOne({ externalId: "3011" });
    assert.equal(before.officialDetailsSource, "factSheet");
    assert.equal(before.feeSingles, 600);

    stub.failSheets = true;
    const report = await sweep(stub);
    assert.ok(report.sheetFailures.length > 0);
    const after = await col().findOne({ externalId: "3011" });
    assert.equal(after.officialDetailsSource, "factSheet");
    assert.equal(after.feeSingles, 600);
    assert.equal(
      after.registrationDeadlineDate.toISOString(),
      before.registrationDeadlineDate.toISOString()
    );
  });

  it("ends the whole sweep when a month cannot be read, writing nothing", async () => {
    await sweep(stub);
    stub.failMonth = true;
    await assert.rejects(sweep(stub, { now: new Date(NOW.getTime() + 30 * DAY) }), /503/);
    assert.equal(await col().countDocuments({ status: "cancelled" }), 0);
  });

  describe("an event that disappears", () => {
    it("is watched at first, cancelled once it has gone unseen long enough, and restored if it returns", async () => {
      await sweep(stub);

      // Gone from AITA, one sweep later: the evidence is a few days old at most.
      stub.october = [TS];
      const soon = await sweep(stub, { now: new Date(NOW.getTime() + 4 * DAY) });
      assert.equal(soon.retirements.cancel.length, 0);
      assert.equal(soon.retirements.watching.length, 1);
      assert.equal((await col().findOne({ externalId: "3011" })).status, "announced");

      // Still gone a sweep a week later, more than 10 days since it was last seen.
      const later = await sweep(stub, { now: new Date(NOW.getTime() + 11 * DAY) });
      assert.equal(later.retirements.cancel.length, 1);
      assert.equal(later.written.cancelled, 1);
      assert.equal((await col().findOne({ externalId: "3011" })).status, "cancelled");

      // Back on the calendar.
      stub.october = [TS, CS];
      await sweep(stub, { now: new Date(NOW.getTime() + 12 * DAY) });
      assert.equal((await col().findOne({ externalId: "3011" })).status, "announced");
    });

    it("is not cancelled by a manual run straight after the scheduled one", async () => {
      await sweep(stub);
      stub.october = [TS];
      const t = new Date(NOW.getTime() + 4 * DAY);
      await sweep(stub, { now: t });
      await sweep(stub, { now: new Date(t.getTime() + 60 * 1000) });
      assert.equal((await col().findOne({ externalId: "3011" })).status, "announced");
    });

    it("never cancels an event that has started", async () => {
      await sweep(stub);
      stub.october = [TS];
      // 2026-11-01: both ladder events started on 10-31, and are missing from the page.
      const report = await sweep(stub, { now: new Date("2026-11-20T00:00:00.000Z") });
      assert.equal(report.retirements.cancel.length, 0);
    });

    it("refuses to cancel anything, or write at all, when the page set looks half read", async () => {
      // Twelve events held, then a sweep that lists only one of them.
      const many = Array.from({ length: 12 }, (_, i) => ({
        ...CS,
        externalId: String(7000 + i),
        city: `City${i}`,
        name: `Event ${i}`,
      }));
      stub.october = many;
      stub.november = [];
      await sweep(stub);
      assert.equal(await col().countDocuments(), 12);

      stub.october = [many[0]];
      const snapshot = await col().find({}).toArray();
      await assert.rejects(
        sweep(stub, { now: new Date(NOW.getTime() + 30 * DAY - 25 * DAY) }),
        /refused, nothing written/
      );
      assert.deepEqual(await col().find({}).toArray(), snapshot);
    });

    it("refuses when AITA lists nothing at all", async () => {
      await sweep(stub);
      stub.october = [];
      stub.november = [];
      await assert.rejects(sweep(stub), /refused, nothing written/);
      assert.equal(await col().countDocuments({ status: "cancelled" }), 0);
    });
  });

  describe("backup", () => {
    it("is handed the rows about to change, before the first write", async () => {
      await sweep(stub);
      let seen: unknown[] = [];
      let countAtBackup = -1;
      await sweep(stub, {
        backup: async (rows: unknown[]) => {
          seen = rows;
          countAtBackup = await col().countDocuments({
            lastCheckedAt: { $gte: new Date(NOW.getTime() + DAY) },
          });
        },
        now: new Date(NOW.getTime() + 2 * DAY),
      });
      assert.equal(seen.length, 3);
      assert.equal(countAtBackup, 0, "nothing had been written when the backup ran");
    });

    it("aborts the sweep when the backup throws", async () => {
      await sweep(stub);
      const snapshot = await col().find({}).toArray();
      await assert.rejects(
        sweep(stub, {
          now: new Date(NOW.getTime() + 2 * DAY),
          backup: () => {
            throw new Error("disk full");
          },
        }),
        /disk full/
      );
      assert.deepEqual(await col().find({}).toArray(), snapshot);
    });
  });

  it("calls onWritten only when something was written", async () => {
    let calls = 0;
    await sweep(stub, { apply: false, onWritten: () => (calls += 1) });
    assert.equal(calls, 0);
    await sweep(stub, { onWritten: () => (calls += 1) });
    assert.equal(calls, 1);
  });
});
