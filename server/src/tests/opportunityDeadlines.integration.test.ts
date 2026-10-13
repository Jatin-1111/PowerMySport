// Tests for the weekly dates-and-checks digest (opportunityDeadlines.ts): the
// pure report, the run against an in-memory database, and the email itself.
//
// Pinned: only live entries are reported on; each window is judged against
// today's date with its edges (today, the last day of the horizon, one past it)
// handled; a window that closed long ago is left alone; "overdue" matches the
// admin's own one-year bar; a week with nothing to say sends nothing; and a
// failure to email one editor does not stop the others.
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
const nodemailer = require("nodemailer");

const { Opportunity } = require("../shared/models/Opportunity");
const {
  CHECK_DUE_WITHIN_DAYS,
  CLOSED_LIVE_WITHIN_DAYS,
  CLOSING_WITHIN_DAYS,
  KEY_DATE_WITHIN_DAYS,
  OPENING_WITHIN_DAYS,
  buildDeadlineReport,
  daysBetween,
  reportIsEmpty,
  runDeadlineDigest,
} = require("../admin/services/opportunityDeadlines");
const { sendOpportunityDeadlinesDigestEmail } = require("../utils/email");
const { STALE_AFTER_DAYS } = require("../shared/validation/opportunityFormat");
const redis = require("../config/redis").default;

const TODAY = "2026-10-13";
/** The date `days` from TODAY, as YYYY-MM-DD. */
const offset = (days: number) =>
  new Date(Date.parse(`${TODAY}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

let n = 0;
const entry = (over: Record<string, unknown> = {}) => {
  n += 1;
  return {
    _id: `id${n}`,
    slug: `entry-${n}`,
    title: `Entry ${n}`,
    status: "published",
    lastVerifiedOn: offset(-10),
    ...over,
  };
};

describe("daysBetween", () => {
  it("counts whole days, forwards and back", () => {
    assert.equal(daysBetween("2026-10-13", "2026-10-13"), 0);
    assert.equal(daysBetween("2026-10-13", "2026-10-20"), 7);
    assert.equal(daysBetween("2026-10-13", "2026-10-12"), -1);
    assert.equal(daysBetween("2026-02-27", "2026-03-02"), 3);
  });
});

describe("buildDeadlineReport", () => {
  it("reports a window by its closing date, with the edges of the horizon", () => {
    const report = buildDeadlineReport(
      [
        entry({ title: "Today", cycle: { closesOn: offset(0) } }),
        entry({ title: "Last day in", cycle: { closesOn: offset(CLOSING_WITHIN_DAYS) } }),
        entry({ title: "One day too far", cycle: { closesOn: offset(CLOSING_WITHIN_DAYS + 1) } }),
      ],
      TODAY
    );
    assert.deepEqual(
      report.closingSoon.map((i: { title: string; days: number }) => [i.title, i.days]),
      [
        ["Today", 0],
        ["Last day in", CLOSING_WITHIN_DAYS],
      ]
    );
  });

  it("reports an opening window and a key date this week, soonest first", () => {
    const report = buildDeadlineReport(
      [
        entry({ title: "B", cycle: { opensOn: offset(OPENING_WITHIN_DAYS) } }),
        entry({ title: "A", cycle: { opensOn: offset(2) } }),
        entry({ title: "Past", cycle: { opensOn: offset(-1) } }),
        entry({
          title: "Trials",
          cycle: {
            keyDates: [
              { label: "Trials", date: offset(KEY_DATE_WITHIN_DAYS) },
              { label: "Too far", date: offset(KEY_DATE_WITHIN_DAYS + 1) },
            ],
          },
        }),
      ],
      TODAY
    );
    assert.deepEqual(
      report.openingSoon.map((i: { title: string }) => i.title),
      ["A", "B"]
    );
    assert.deepEqual(
      report.keyDates.map((i: { label: string }) => i.label),
      ["Trials"]
    );
  });

  it("flags a live entry whose window closed recently, and leaves an old closure alone", () => {
    const report = buildDeadlineReport(
      [
        entry({ title: "Just closed", cycle: { closesOn: offset(-3) } }),
        entry({ title: "Edge", cycle: { closesOn: offset(-CLOSED_LIVE_WITHIN_DAYS) } }),
        entry({ title: "Long closed", cycle: { closesOn: offset(-CLOSED_LIVE_WITHIN_DAYS - 1) } }),
      ],
      TODAY
    );
    assert.deepEqual(
      report.closedButLive.map((i: { title: string }) => i.title),
      ["Just closed", "Edge"]
    );
  });

  it("uses the admin's one-year bar: overdue past it, due soon in the month before", () => {
    const report = buildDeadlineReport(
      [
        entry({ title: "Overdue", lastVerifiedOn: offset(-(STALE_AFTER_DAYS + 20)) }),
        entry({ title: "Exactly a year", lastVerifiedOn: offset(-STALE_AFTER_DAYS) }),
        entry({
          title: "Due soon",
          lastVerifiedOn: offset(-(STALE_AFTER_DAYS - CHECK_DUE_WITHIN_DAYS)),
        }),
        entry({
          title: "Fine",
          lastVerifiedOn: offset(-(STALE_AFTER_DAYS - CHECK_DUE_WITHIN_DAYS - 1)),
        }),
      ],
      TODAY
    );
    assert.deepEqual(
      report.checkOverdue.map((i: { title: string }) => i.title),
      ["Overdue"]
    );
    assert.deepEqual(report.checkDueSoon.map((i: { title: string }) => i.title).sort(), [
      "Due soon",
      "Exactly a year",
    ]);
  });

  it("says nothing about a draft except how many were never verified", () => {
    const report = buildDeadlineReport(
      [
        entry({ status: "draft", lastVerifiedOn: undefined, cycle: { closesOn: offset(2) } }),
        entry({ status: "draft", lastVerifiedOn: undefined }),
        entry({ status: "draft", lastVerifiedOn: offset(-5) }),
      ],
      TODAY
    );
    assert.equal(report.neverVerifiedDrafts, 2);
    assert.equal(report.closingSoon.length, 0);
    assert.equal(reportIsEmpty(report), true, "draft counts alone are not worth an email");
  });

  it("ignores a malformed date instead of failing", () => {
    const report = buildDeadlineReport(
      [
        entry({ cycle: { closesOn: "next Friday", opensOn: "2026-13-45" } }),
        entry({ lastVerifiedOn: "yesterday" }),
      ],
      TODAY
    );
    assert.equal(reportIsEmpty(report), true);
  });
});

describe("runDeadlineDigest and the email", () => {
  let mongod: { getUri(): string; stop(): Promise<void> };

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
    n = 0;
    await Opportunity.deleteMany({});
  });

  const seed = (over: Record<string, unknown> = {}) => {
    n += 1;
    return Opportunity.create({
      slug: `entry-${n}`,
      track: "scholarship",
      category: "government",
      title: `Entry ${n}`,
      status: "published",
      lastVerifiedOn: offset(-10),
      ...over,
    });
  };

  const editors = async () => [
    { email: "a@example.test", name: "Asha" },
    { email: "b@example.test", name: "Bala" },
  ];

  it("sends nothing in a week with nothing to say", async () => {
    await seed({ cycle: { closesOn: offset(200), keyDates: [] } });
    const sent: unknown[] = [];

    const summary = await runDeadlineDigest({
      today: TODAY,
      recipients: editors,
      send: async (o: unknown) => {
        sent.push(o);
      },
    });

    assert.equal(summary.sent, false);
    assert.equal(sent.length, 0);
  });

  it("emails every editor when something is coming due", async () => {
    await seed({ title: "Closing soon", cycle: { closesOn: offset(5), keyDates: [] } });
    const sent: Array<{ to: string; report: { closingSoon: unknown[] } }> = [];

    const summary = await runDeadlineDigest({
      today: TODAY,
      recipients: editors,
      send: async (o: { to: string; report: { closingSoon: unknown[] } }) => {
        sent.push(o);
      },
    });

    assert.equal(summary.sent, true);
    assert.equal(summary.recipients, 2);
    assert.deepEqual(
      sent.map((s) => s.to),
      ["a@example.test", "b@example.test"]
    );
    assert.equal(sent[0]?.report.closingSoon.length, 1);
  });

  it("still emails the others when one editor's email fails", async () => {
    await seed({ cycle: { closesOn: offset(5), keyDates: [] } });
    const sent: string[] = [];

    const summary = await runDeadlineDigest({
      today: TODAY,
      recipients: editors,
      send: async (o: { to: string }) => {
        if (o.to === "a@example.test") throw new Error("mailbox full");
        sent.push(o.to);
      },
    });

    assert.deepEqual(sent, ["b@example.test"]);
    assert.equal(summary.recipients, 1);
  });

  it("renders every section, with the entry linked and the subject summarising it", async () => {
    let captured: { subject: string; html: string; to: string } | null = null;
    const original = nodemailer.createTransport;
    nodemailer.createTransport = () => ({
      sendMail: async (options: { subject: string; html: string; to: string }) => {
        captured = options;
        return { messageId: "test", rejected: [] };
      },
    });
    try {
      const report = buildDeadlineReport(
        [
          entry({ _id: "abc123", title: "Closing <scheme>", cycle: { closesOn: offset(6) } }),
          entry({ title: "Opening", cycle: { opensOn: offset(3) } }),
          entry({
            title: "Trials one",
            cycle: { keyDates: [{ label: "Trials", date: offset(1) }] },
          }),
          entry({ title: "Closed", cycle: { closesOn: offset(-4) } }),
          entry({ title: "Overdue", lastVerifiedOn: offset(-(STALE_AFTER_DAYS + 5)) }),
          entry({ status: "draft", lastVerifiedOn: undefined }),
        ],
        TODAY
      );
      await sendOpportunityDeadlinesDigestEmail({
        to: "a@example.test",
        name: "Asha",
        report,
        reviewUrl: "https://admin.test/admin/opportunities",
        today: TODAY,
      });
    } finally {
      nodemailer.createTransport = original;
    }

    assert.ok(captured, "the email was sent through the transport");
    const { subject, html } = captured as unknown as { subject: string; html: string };
    assert.match(subject, /1 closing/);
    assert.match(subject, /1 opening/);
    assert.match(subject, /1 closed but live/);
    assert.match(subject, /1 due a check/);
    for (const heading of [
      "Windows closing soon",
      "Windows opening soon",
      "Key dates this week",
      "Window closed, still live",
      "Overdue for a check",
    ]) {
      assert.ok(html.includes(heading), `has the "${heading}" section`);
    }
    assert.ok(html.includes("https://admin.test/admin/opportunities/abc123"), "links the entry");
    assert.ok(html.includes("Closing &lt;scheme&gt;"), "escapes the title");
    assert.ok(!html.includes("Closing <scheme>"));
    assert.ok(html.includes("in 6 days"));
    assert.ok(html.includes("never been verified"));
  });
});
