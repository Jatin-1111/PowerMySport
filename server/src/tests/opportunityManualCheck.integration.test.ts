// Tests for recording that a person checked an unreadable source by hand
// (SourceWatch.manualCheckDue, recordManualCheck, and the Monday digest section).
//
// Pinned: an unreadable source is due a look when nobody has looked, when its
// problem is newer than the last look, or when the last look is over 30 days old,
// and never otherwise; a hand check quiets it like a dismissal does; the weekly
// run, which re-reads the source every Monday, must not erase a hand check; the
// tile counts only what is due; and the digest lists what is due and says nothing
// when nothing is.
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
const request = require("supertest");
const nodemailer = require("nodemailer");

const { app } = require("../app");
const Admin = require("../admin/models/Admin").default;
const { Opportunity } = require("../shared/models/Opportunity");
const {
  SourceWatch,
  MANUAL_CHECK_EVERY_DAYS,
  lastLookedAt,
  manualCheckDue,
  watchNeedsAttention,
} = require("../shared/models/SourceWatch");
const { runOpportunityWatch } = require("../admin/services/opportunityWatch");
const {
  buildDeadlineReport,
  reportIsEmpty,
  runDeadlineDigest,
} = require("../admin/services/opportunityDeadlines");
const { sendOpportunityDeadlinesDigestEmail } = require("../utils/email");
const { generateToken } = require("../utils/jwt");
const redis = require("../config/redis").default;

const DAY = 86_400_000;
const NOW = new Date("2026-10-14T06:00:00Z");
const ago = (days: number, from = NOW) => new Date(from.getTime() - days * DAY);

const blocked = (over: Record<string, unknown> = {}) => ({
  status: "blocked",
  statusSince: ago(60),
  ...over,
});

describe("manualCheckDue", () => {
  it("is due when nobody has ever looked", () => {
    assert.equal(manualCheckDue(blocked(), NOW), true);
  });

  it("is quiet for a month after a hand check, due the day after", () => {
    const at = (days: number) => ({ lastManualCheckAt: ago(days) });
    assert.equal(manualCheckDue(blocked(at(1)), NOW), false);
    assert.equal(
      manualCheckDue(blocked(at(MANUAL_CHECK_EVERY_DAYS)), NOW),
      false,
      "exactly 30 days"
    );
    assert.equal(manualCheckDue(blocked(at(MANUAL_CHECK_EVERY_DAYS + 1)), NOW), true);
  });

  it("counts a dismissal or a review of the source as a look", () => {
    assert.equal(manualCheckDue(blocked({ acknowledgedAt: ago(3) }), NOW), false);
    assert.equal(manualCheckDue(blocked({ acknowledgedAt: ago(45) }), NOW), true);
  });

  it("goes by the latest look when there are several", () => {
    const watch = blocked({ acknowledgedAt: ago(90), lastManualCheckAt: ago(2) });
    assert.equal(lastLookedAt(watch)?.getTime(), ago(2).getTime());
    assert.equal(manualCheckDue(watch, NOW), false);
  });

  it("is due again at once when the problem is newer than the last look", () => {
    const watch = blocked({ lastManualCheckAt: ago(5), statusSince: ago(1) });
    assert.equal(manualCheckDue(watch, NOW), true);
  });

  it("is never due for a source that can be read", () => {
    assert.equal(manualCheckDue({ status: "ok", statusSince: ago(400) }, NOW), false);
  });

  it("watchNeedsAttention uses the change rule for a readable source and the hand-check rule otherwise", () => {
    const changed = { status: "ok", statusSince: ago(30), lastChangedAt: ago(1) };
    assert.equal(watchNeedsAttention(changed, NOW), true);
    assert.equal(watchNeedsAttention({ ...changed, acknowledgedAt: ago(0.5) }, NOW), false);
    assert.equal(watchNeedsAttention(blocked(), NOW), true);
    assert.equal(watchNeedsAttention(blocked({ lastManualCheckAt: ago(2) }), NOW), false);
  });
});

describe("hand checks against a database", () => {
  let mongod: { getUri(): string; stop(): Promise<void> };
  let manager: string;

  const signIn = async (permissions: string[]) => {
    const id = new mongoose.Types.ObjectId();
    await Admin.collection.insertOne({
      _id: id,
      name: "Test admin",
      email: `${id.toString()}@example.test`,
      password: "not-a-real-hash",
      role: "OPERATIONS_ADMIN",
      permissions,
      isActive: true,
    });
    return generateToken({
      id: id.toString(),
      email: `${id}@example.test`,
      role: "OPERATIONS_ADMIN",
    });
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
      Admin.deleteMany({}),
    ]);
    manager = await signIn(["opportunities:manage"]);
  });

  const seedBlocked = async (url = "https://blocked.test/circular", title = "CBSE concession") => {
    await Opportunity.create({
      slug: `entry-${Math.random().toString(36).slice(2, 8)}`,
      track: "admission",
      category: "school",
      title,
      sources: [{ label: "Circular", url }],
      status: "draft",
    });
    const watch = await SourceWatch.create({
      url,
      status: "blocked",
      note: "The site refused our server.",
      firstCheckedAt: ago(60),
      lastCheckedAt: ago(1),
      statusSince: ago(60),
    });
    return String(watch._id);
  };

  const list = async () => {
    const res = await request(app)
      .get("/api/admin/opportunity-watch")
      .set("Authorization", `Bearer ${manager}`);
    return res.body.data.watches as Array<{
      needsAttention: boolean;
      lastLookedAt: string | null;
      lastManualCheckNote?: string;
      lastManualCheckBy?: string;
    }>;
  };
  const check = (id: string, body: Record<string, unknown> = {}, token = manager) =>
    request(app)
      .post(`/api/admin/opportunity-watch/${id}/manual-check`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  it("starts due, and is quiet after a hand check, which records who, when and why", async () => {
    const id = await seedBlocked();
    assert.equal((await list())[0]?.needsAttention, true);

    const res = await check(id, { note: "  Opened it. No new circular.  " });
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const [watch] = await list();
    assert.equal(watch?.needsAttention, false);
    assert.ok(watch?.lastLookedAt);
    assert.equal(watch?.lastManualCheckNote, "Opened it. No new circular.");
    assert.ok(watch?.lastManualCheckBy, "who did it is recorded");
  });

  it("comes due again after 30 days, and at once if its problem changes", async () => {
    const id = await seedBlocked();
    await check(id);
    assert.equal((await list())[0]?.needsAttention, false);

    const longAgo = ago(MANUAL_CHECK_EVERY_DAYS + 1, new Date());
    await SourceWatch.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { lastManualCheckAt: longAgo, acknowledgedAt: longAgo } }
    );
    assert.equal((await list())[0]?.needsAttention, true, "a month on");

    await check(id);
    assert.equal((await list())[0]?.needsAttention, false);
    await SourceWatch.updateOne(
      { _id: id },
      { $set: { status: "gone", statusSince: new Date(Date.now() + 1000) } }
    );
    assert.equal((await list())[0]?.needsAttention, true, "a new problem after the last look");
  });

  it("clears the last note when a later check has none", async () => {
    const id = await seedBlocked();
    await check(id, { note: "first" });
    await check(id);
    assert.equal((await list())[0]?.lastManualCheckNote, undefined);
  });

  it("is not erased by the weekly run reading the same blocked page again", async () => {
    const url = "https://blocked.test/circular";
    await Opportunity.create({
      slug: "cbse",
      track: "admission",
      category: "school",
      title: "CBSE concession",
      sources: [{ label: "Circular", url }],
      status: "draft",
    });
    const run = () =>
      runOpportunityWatch({
        fetchImpl: async (u: string) =>
          u.endsWith("/robots.txt")
            ? new Response("", { status: 404 })
            : new Response("Forbidden", { status: 403, headers: { "content-type": "text/html" } }),
        resolveUrl: async (raw: string) => raw,
        pauseMs: 0,
        notify: false,
        autoDiff: null,
      });
    await run();
    const id = String((await SourceWatch.findOne({ url }).lean())._id);
    await check(id, { note: "looked" });

    await run();

    const [watch] = await list();
    assert.equal(watch?.lastManualCheckNote, "looked", "the run did not erase the hand check");
    assert.equal(watch?.needsAttention, false, "and the unchanged problem stays quiet");
  });

  it("rejects a bad id, an unknown source, a note that is too long, and a view-only admin", async () => {
    const id = await seedBlocked();
    assert.equal((await check("not-an-id")).status, 400);
    assert.equal((await check(String(new mongoose.Types.ObjectId()))).status, 404);
    assert.equal((await check(id, { note: "x".repeat(301) })).status, 400);
    const viewer = await signIn(["opportunities:view"]);
    assert.equal((await check(id, {}, viewer)).status, 403);
    assert.equal((await list())[0]?.needsAttention, true, "none of those recorded a check");
  });

  it("refuses a hand check on a source our server can read, so a change is never hidden by one", async () => {
    const id = await seedBlocked();
    await SourceWatch.updateOne(
      { _id: id },
      { $set: { status: "ok", lastChangedAt: new Date(), changeKind: "text" } }
    );
    assert.equal((await list())[0]?.needsAttention, true, "it has a change waiting");

    const res = await check(id, { note: "looked" });

    assert.equal(res.status, 400);
    assert.match(res.body.message ?? res.body.errors?.join(" ") ?? "", /Dismiss/);
    assert.equal((await list())[0]?.needsAttention, true, "the change is still flagged");
    assert.equal((await SourceWatch.findById(id).lean()).lastManualCheckAt, undefined);
  });

  it("counts only the unreadable sources that are due, in the tile summary", async () => {
    const due = await seedBlocked("https://a.test/x", "Due entry");
    const quiet = await seedBlocked("https://b.test/y", "Quiet entry");
    await check(quiet);

    const res = await request(app)
      .get("/api/admin/opportunities/queue-summary")
      .set("Authorization", `Bearer ${manager}`);

    assert.equal(res.body.data.unreadable, 1);
    assert.ok(due);
  });

  describe("the Monday digest", () => {
    const items = async (ids: Array<{ url: string; title: string }>) =>
      ids.map((i) => ({
        _id: "x",
        url: i.url,
        status: "blocked",
        needsAttention: true,
        entries: [{ id: "1", slug: "s", title: i.title, status: "draft" }],
        lastLookedAt: null,
      }));

    it("is worth sending on its own when a source is due, and says nothing when none is", async () => {
      const sent: Array<{ report: { manualChecks: unknown[] } }> = [];
      const send = async (o: { report: { manualChecks: unknown[] } }) => {
        sent.push(o);
      };
      const recipients = async () => [{ email: "a@example.test", name: "Asha" }];

      const none = await runDeadlineDigest({
        today: "2026-10-14",
        recipients,
        send,
        watches: async () => [],
      });
      assert.equal(none.sent, false);

      const some = await runDeadlineDigest({
        today: "2026-10-14",
        recipients,
        send,
        watches: async () => items([{ url: "https://a.test/x", title: "CBSE concession" }]),
      });
      assert.equal(some.sent, true);
      assert.equal(sent[0]?.report.manualChecks.length, 1);
    });

    it("leaves out a readable source and a source no entry cites", async () => {
      const send = async () => undefined;
      const watches = await items([{ url: "https://a.test/x", title: "T" }]);
      const readable = { ...watches[0], status: "ok", needsAttention: true };
      const orphan = { ...watches[0], entries: [] };

      const summary = await runDeadlineDigest({
        today: "2026-10-14",
        recipients: async () => [{ email: "a@example.test", name: "Asha" }],
        send,
        watches: async () => [readable, orphan],
      });

      assert.equal(summary.report.manualChecks.length, 0);
    });

    it("still sends the week's dates when the watch records cannot be loaded", async () => {
      await Opportunity.create({
        slug: "closing",
        track: "admission",
        category: "college",
        title: "Closing soon",
        status: "published",
        lastVerifiedOn: "2026-10-01",
        cycle: { closesOn: "2026-10-18", keyDates: [] },
      });
      const sent: unknown[] = [];

      const summary = await runDeadlineDigest({
        today: "2026-10-14",
        recipients: async () => [{ email: "a@example.test", name: "Asha" }],
        send: async (o: unknown) => {
          sent.push(o);
        },
        watches: async () => {
          throw new Error("database hiccup");
        },
      });

      assert.equal(summary.sent, true);
      assert.equal(summary.report.closingSoon.length, 1);
      assert.equal(summary.report.manualChecks.length, 0);
    });

    it("an empty hand-check list leaves the report as empty as before", () => {
      assert.equal(reportIsEmpty(buildDeadlineReport([], "2026-10-14")), true);
    });

    it("renders the section, caps it at ten, and counts the rest", async () => {
      let captured: { subject: string; html: string } | null = null;
      const original = nodemailer.createTransport;
      nodemailer.createTransport = () => ({
        sendMail: async (options: { subject: string; html: string }) => {
          captured = options;
          return { messageId: "t", rejected: [] };
        },
      });
      try {
        const report = buildDeadlineReport([], "2026-10-14");
        report.manualChecks = Array.from({ length: 12 }, (_, i) => ({
          url: `https://gov${i}.test/circular`,
          entries: [`Entry ${i}`],
          lastLooked: i === 0 ? "2026-08-01" : null,
        }));
        await sendOpportunityDeadlinesDigestEmail({
          to: "a@example.test",
          name: "Asha",
          report,
          reviewUrl: "https://admin.test/admin/opportunities",
          today: "2026-10-14",
        });
      } finally {
        nodemailer.createTransport = original;
      }
      const { subject, html } = captured as unknown as { subject: string; html: string };
      assert.match(subject, /12 to check by hand/);
      assert.ok(html.includes("Check by hand (12)"));
      assert.ok(html.includes("https://gov9.test/circular"), "the tenth is listed");
      assert.ok(!html.includes("https://gov10.test/circular"), "the eleventh is not");
      assert.ok(html.includes("And 2 more"));
      assert.ok(html.includes("never looked at"));
      assert.ok(html.includes("last looked at 1 Aug 2026"));
    });
  });
});
