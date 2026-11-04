// Integration tests for reading changed sources automatically after the weekly
// watch (opportunityAutoDiff.ts), against an in-memory database and a fake
// network. Gemini is never called: the read step is injected.
//
// Pinned: a changed source becomes an ordinary PENDING_REVIEW submission with no
// submitting admin; one already waiting is not repeated; a read that comes to
// nothing leaves no record; a run reads at most the cap and defers the rest; the
// watch hands over only sources that changed; and a failure in the read never
// fails the check itself.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { Opportunity } = require("../shared/models/Opportunity");
const { SourceWatch } = require("../shared/models/SourceWatch");
const { DataSourceSubmission } = require("../shared/models/DataSourceSubmission");
const { runOpportunityWatch, classifyResponse } = require("../admin/services/opportunityWatch");
const {
  autoDiffEnabled,
  createAutoDiffs,
  MAX_AUTO_DIFFS_PER_RUN,
} = require("../admin/services/opportunityAutoDiff");
const redis = require("../config/redis").default;

let mongod: { getUri(): string; stop(): Promise<void> };

let pages: Record<string, { status: number; type: string; body: string }> = {};

const fakeFetch = async (url: string) => {
  if (url.endsWith("/robots.txt")) {
    return new Response("User-agent: *\nDisallow:\n", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }
  const page = pages[url];
  if (!page) return new Response("", { status: 404, headers: { "content-type": "text/html" } });
  const res = new Response(page.body, {
    status: page.status,
    headers: { "content-type": page.type },
  });
  Object.defineProperty(res, "url", { value: url });
  return res;
};

const htmlPage = (text: string) => ({
  status: 200,
  type: "text/html",
  body: `<html><body><main>${text} ${"filler ".repeat(300)}</main></body></html>`,
});

const seedEntry = (slug: string, sources: string[]) =>
  Opportunity.create({
    slug,
    track: "scholarship",
    category: "government",
    title: slug,
    sources: sources.map((url) => ({ label: "Source", url })),
    status: "draft",
  });

/** A read that succeeds, as the Gemini one would. */
const readOk = async (submission: { status: string; save(): Promise<unknown> }) => {
  submission.status = "PENDING_REVIEW";
  await submission.save();
};
/** A read that finds nothing usable. */
const readNothing = async (submission: { status: string; save(): Promise<unknown> }) => {
  submission.status = "EXTRACTION_FAILED";
  await submission.save();
};

before(async () => {
  mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  await redis.quit?.().catch(() => undefined);
});

beforeEach(async () => {
  await Promise.all([
    Opportunity.deleteMany({}),
    SourceWatch.deleteMany({}),
    DataSourceSubmission.deleteMany({}),
  ]);
  pages = {};
});

describe("autoDiffEnabled", () => {
  it("is on in production, off elsewhere, and either can be overridden", () => {
    assert.equal(autoDiffEnabled({ NODE_ENV: "production" }), true);
    assert.equal(autoDiffEnabled({ NODE_ENV: "development" }), false);
    assert.equal(autoDiffEnabled({}), false);
    assert.equal(
      autoDiffEnabled({ NODE_ENV: "development", OPPORTUNITY_WATCH_AUTO_DIFF: "true" }),
      true
    );
    assert.equal(
      autoDiffEnabled({ NODE_ENV: "production", OPPORTUNITY_WATCH_AUTO_DIFF: "false" }),
      false
    );
  });
});

describe("classifyResponse", () => {
  it("treats a redirect that is still the answer as blocked, not as a generic error", () => {
    const result = classifyResponse({
      requestedUrl: "https://gov.test/file.pdf",
      httpStatus: 307,
      finalUrl: "https://www.gov.test/file.pdf",
      contentType: "text/html",
      body: Buffer.alloc(0),
    });
    assert.equal(result.status, "blocked");
  });
});

describe("createAutoDiffs", () => {
  it("submits a changed source as an ordinary review item, with no submitting admin", async () => {
    await seedEntry("khelo-india", ["https://site.test/scheme"]);

    const summary = await createAutoDiffs(
      [{ url: "https://site.test/scheme", changeKind: "text", entries: [{ slug: "khelo-india" }] }],
      { read: readOk }
    );

    assert.equal(summary.created, 1);
    const stored = await DataSourceSubmission.find({}).lean();
    assert.equal(stored.length, 1);
    assert.equal(stored[0].status, "PENDING_REVIEW");
    assert.equal(stored[0].targetType, "OPPORTUNITY");
    assert.equal(stored[0].opportunitySlug, "khelo-india");
    assert.equal(stored[0].sourceKind, "LINK");
    assert.equal(stored[0].sourceUrl, "https://site.test/scheme");
    assert.equal(stored[0].autoDetected, true);
    assert.equal(stored[0].detectedChange, "text");
    assert.equal(stored[0].submittedBy, undefined);
  });

  it("does not repeat a change list that is still waiting for a person", async () => {
    await seedEntry("khelo-india", ["https://site.test/scheme"]);
    const changed = [
      { url: "https://site.test/scheme", changeKind: "text", entries: [{ slug: "khelo-india" }] },
    ];

    await createAutoDiffs(changed, { read: readOk });
    const again = await createAutoDiffs(changed, { read: readOk });

    assert.equal(again.created, 0);
    assert.equal(again.skipped, 1);
    assert.equal(await DataSourceSubmission.countDocuments({}), 1);
  });

  it("raises a new one once the earlier one has been reviewed", async () => {
    await seedEntry("khelo-india", ["https://site.test/scheme"]);
    const changed = [
      { url: "https://site.test/scheme", changeKind: "text", entries: [{ slug: "khelo-india" }] },
    ];

    await createAutoDiffs(changed, { read: readOk });
    await DataSourceSubmission.updateMany({}, { $set: { status: "APPROVED" } });
    const again = await createAutoDiffs(changed, { read: readOk });

    assert.equal(again.created, 1);
    assert.equal(await DataSourceSubmission.countDocuments({}), 2);
  });

  it("is not blocked by a read that began long ago and never finished", async () => {
    await seedEntry("khelo-india", ["https://site.test/scheme"]);
    const changed = [
      { url: "https://site.test/scheme", changeKind: "text", entries: [{ slug: "khelo-india" }] },
    ];
    const stuck = await DataSourceSubmission.create({
      targetType: "OPPORTUNITY",
      sportSlug: "tennis",
      opportunitySlug: "khelo-india",
      opportunityTrack: "scholarship",
      sourceLabel: "Changed source: site.test",
      sourceKind: "LINK",
      sourceUrl: "https://site.test/scheme",
      status: "PENDING_EXTRACTION",
      autoDetected: true,
    });
    // createdAt is immutable through Mongoose, so backdate it in the collection.
    await DataSourceSubmission.collection.updateOne(
      { _id: stuck._id },
      { $set: { createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) } }
    );

    const summary = await createAutoDiffs(changed, { read: readOk });
    assert.equal(summary.created, 1, "a three-hour-old unfinished read does not count as waiting");

    // A read that began a moment ago still does.
    await DataSourceSubmission.deleteMany({});
    await DataSourceSubmission.create({
      targetType: "OPPORTUNITY",
      sportSlug: "tennis",
      opportunitySlug: "khelo-india",
      opportunityTrack: "scholarship",
      sourceLabel: "Changed source: site.test",
      sourceKind: "LINK",
      sourceUrl: "https://site.test/scheme",
      status: "PENDING_EXTRACTION",
      autoDetected: true,
    });
    const again = await createAutoDiffs(changed, { read: readOk });
    assert.equal(again.skipped, 1);
    assert.equal(again.created, 0);
  });

  it("keeps no record of a read that found nothing usable", async () => {
    await seedEntry("khelo-india", ["https://site.test/scheme"]);

    const summary = await createAutoDiffs(
      [{ url: "https://site.test/scheme", changeKind: "text", entries: [{ slug: "khelo-india" }] }],
      { read: readNothing }
    );

    assert.equal(summary.unreadable, 1);
    assert.equal(summary.created, 0);
    assert.equal(await DataSourceSubmission.countDocuments({}), 0);
  });

  it("treats a read that throws like one that found nothing", async () => {
    await seedEntry("khelo-india", ["https://site.test/scheme"]);

    const summary = await createAutoDiffs(
      [{ url: "https://site.test/scheme", changeKind: "file", entries: [{ slug: "khelo-india" }] }],
      {
        read: async () => {
          throw new Error("quota exceeded");
        },
      }
    );

    assert.equal(summary.unreadable, 1);
    assert.equal(await DataSourceSubmission.countDocuments({}), 0);
  });

  it("submits the source once for each entry that cites it", async () => {
    await seedEntry("khelo-india", ["https://site.test/scheme"]);
    await seedEntry("state-scheme", ["https://site.test/scheme"]);

    const summary = await createAutoDiffs(
      [
        {
          url: "https://site.test/scheme",
          changeKind: "documents",
          entries: [{ slug: "khelo-india" }, { slug: "state-scheme" }],
        },
      ],
      { read: readOk }
    );

    assert.equal(summary.created, 2);
    const slugs = (await DataSourceSubmission.find({}).lean()).map(
      (s: { opportunitySlug: string }) => s.opportunitySlug
    );
    assert.deepEqual(slugs.sort(), ["khelo-india", "state-scheme"]);
  });

  it("skips an entry that no longer exists", async () => {
    const summary = await createAutoDiffs(
      [{ url: "https://site.test/scheme", changeKind: "text", entries: [{ slug: "deleted" }] }],
      { read: readOk }
    );
    assert.equal(summary.skipped, 1);
    assert.equal(await DataSourceSubmission.countDocuments({}), 0);
  });

  it("reads at most the cap and defers the rest to a person", async () => {
    const total = MAX_AUTO_DIFFS_PER_RUN + 3;
    const changed = [];
    for (let i = 0; i < total; i += 1) {
      await seedEntry(`entry-${i}`, [`https://site.test/${i}`]);
      changed.push({
        url: `https://site.test/${i}`,
        changeKind: "text",
        entries: [{ slug: `entry-${i}` }],
      });
    }

    const summary = await createAutoDiffs(changed, { read: readOk });

    assert.equal(summary.created, MAX_AUTO_DIFFS_PER_RUN);
    assert.equal(summary.deferred, 3);
    assert.equal(await DataSourceSubmission.countDocuments({}), MAX_AUTO_DIFFS_PER_RUN);
  });
});

describe("runOpportunityWatch with auto-diff", () => {
  const run = (autoDiff: unknown) =>
    runOpportunityWatch({
      fetchImpl: fakeFetch,
      resolveUrl: async (raw: string) => raw,
      pauseMs: 0,
      notify: false,
      autoDiff,
    });

  it("hands over only the sources that changed, never the baseline run", async () => {
    pages["https://site.test/scheme"] = htmlPage("Rules for 2026");
    pages["https://site.test/other"] = htmlPage("Stable page");
    await seedEntry("khelo-india", ["https://site.test/scheme", "https://site.test/other"]);

    const calls: Array<Array<{ url: string; changeKind: string }>> = [];
    const spy = async (changed: Array<{ url: string; changeKind: string }>) => {
      calls.push(changed);
      return { created: changed.length, skipped: 0, unreadable: 0, deferred: 0 };
    };

    const first = await run(spy);
    assert.equal(calls.length, 0, "the first run only records baselines");
    assert.equal(first.autoDiffs, undefined);

    pages["https://site.test/scheme"] = htmlPage("Rules for 2027, entirely rewritten");
    const second = await run(spy);

    assert.equal(calls.length, 1);
    assert.deepEqual(
      (calls[0] ?? []).map((c) => [c.url, c.changeKind]),
      [["https://site.test/scheme", "text"]]
    );
    assert.equal(second.autoDiffs?.created, 1);
  });

  it("does not hand over a source it could not read", async () => {
    pages["https://site.test/scheme"] = htmlPage("Rules for 2026");
    await seedEntry("khelo-india", ["https://site.test/scheme"]);
    const calls: unknown[] = [];
    const spy = async (changed: unknown[]) => {
      calls.push(changed);
      return { created: 0, skipped: 0, unreadable: 0, deferred: 0 };
    };

    await run(spy);
    pages["https://site.test/scheme"] = { status: 403, type: "text/html", body: "Forbidden" };
    await run(spy);

    assert.equal(calls.length, 0);
  });

  it("is switched off by passing null", async () => {
    pages["https://site.test/scheme"] = htmlPage("Rules for 2026");
    await seedEntry("khelo-india", ["https://site.test/scheme"]);
    await run(null);
    pages["https://site.test/scheme"] = htmlPage("Rules for 2027, entirely rewritten");

    const summary = await run(null);

    assert.equal(summary.changed, 1);
    assert.equal(summary.autoDiffs, undefined);
    assert.equal(await DataSourceSubmission.countDocuments({}), 0);
  });

  it("still records the change when the read throws", async () => {
    pages["https://site.test/scheme"] = htmlPage("Rules for 2026");
    await seedEntry("khelo-india", ["https://site.test/scheme"]);
    await run(null);
    pages["https://site.test/scheme"] = htmlPage("Rules for 2027, entirely rewritten");

    const summary = await run(async () => {
      throw new Error("Gemini is down");
    });

    assert.equal(summary.changed, 1);
    const watch = await SourceWatch.findOne({ url: "https://site.test/scheme" }).lean();
    assert.equal(watch?.changeKind, "text");
  });
});
