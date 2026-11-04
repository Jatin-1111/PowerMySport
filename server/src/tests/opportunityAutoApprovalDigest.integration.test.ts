/* eslint-disable @typescript-eslint/no-var-requires */
// The weekly email must say what the AI approver did, because an editor who is
// never told cannot revert what they would have disagreed with.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { DataSourceSubmission } = require("../shared/models/DataSourceSubmission");
const { Opportunity } = require("../shared/models/Opportunity");
const { runDeadlineDigest, reportIsEmpty } = require("../admin/services/opportunityDeadlines");
const nodemailer = require("nodemailer");
const { sendOpportunityDeadlinesDigestEmail } = require("../utils/email");

let memoryServer: { getUri(): string; stop(): Promise<void> };

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
});
after(async () => {
  await mongoose.disconnect();
  await memoryServer.stop();
});
beforeEach(async () => {
  await Promise.all([DataSourceSubmission.deleteMany({}), Opportunity.deleteMany({})]);
});

const entry = (slug: string, title: string) =>
  Opportunity.create({
    slug,
    track: "admission",
    category: "academy",
    title,
    status: "published",
    lastVerifiedOn: new Date().toISOString().slice(0, 10),
  });

const settled = (
  entryId: string,
  action: string,
  ageDays: number,
  over: Record<string, unknown> = {}
) =>
  DataSourceSubmission.create({
    targetType: "OPPORTUNITY",
    sportSlug: "football",
    sourceKind: "LINK",
    sourceUrl: "https://example.org/x",
    status: "APPROVED",
    submittedBy: new mongoose.Types.ObjectId(),
    autoApproval: {
      action,
      actedAt: new Date(Date.now() - ageDays * 86_400_000),
      entryId,
      pass: true,
      failed: [],
      ...over,
    },
  });

const run = async () => {
  const sent: Array<{ report: { autoApprovals?: Array<{ title: string; action: string }> } }> = [];
  const summary = await runDeadlineDigest({
    watches: async () => [],
    recipients: async () => [{ email: "editor@example.test", name: "Editor" }],
    send: async (options: (typeof sent)[number]) => {
      sent.push(options);
    },
  });
  return { sent, summary };
};

describe("the weekly digest and the AI approver", () => {
  it("reports what the AI did this week, newest first, with the entry's name", async () => {
    const a = await entry("a", "Scheme A");
    const b = await entry("b", "Scheme B");
    await settled(String(a._id), "approved", 3);
    await settled(String(b._id), "published", 1);

    const { sent, summary } = await run();
    assert.equal(summary.sent, true, "an otherwise quiet week still sends when the AI acted");
    assert.deepEqual(
      sent[0]?.report.autoApprovals?.map((item) => [item.title, item.action]),
      [
        ["Scheme B", "published"],
        ["Scheme A", "approved"],
      ]
    );
  });

  it("leaves out what is older than a week, and what an editor already reverted", async () => {
    const a = await entry("a", "Scheme A");
    const b = await entry("b", "Scheme B");
    const c = await entry("c", "Scheme C");
    await settled(String(a._id), "approved", 9);
    await settled(String(b._id), "approved", 1, { revertedAt: new Date() });
    await settled(String(c._id), "reverified", 2);

    const { sent } = await run();
    assert.deepEqual(
      sent[0]?.report.autoApprovals?.map((item) => item.title),
      ["Scheme C"]
    );
  });

  it("does not send when there is nothing to report at all", async () => {
    await entry("a", "Scheme A");
    const { sent, summary } = await run();
    assert.equal(summary.sent, false);
    assert.equal(sent.length, 0);
  });

  it("counts an AI action as something worth sending, and an old report object without the list as empty", () => {
    const empty = {
      closingSoon: [],
      openingSoon: [],
      keyDates: [],
      closedButLive: [],
      checkOverdue: [],
      checkDueSoon: [],
      neverVerifiedDrafts: 0,
      manualChecks: [],
    };
    assert.equal(reportIsEmpty(empty), true);
    assert.equal(
      reportIsEmpty({
        ...empty,
        autoApprovals: [{ title: "x", action: "approved", submissionId: "1" }],
      }),
      false
    );
  });

  it("lists each one in the email, linked to the reading where it can be reverted, with titles escaped", async () => {
    let captured: { subject: string; html: string } | null = null;
    const original = nodemailer.createTransport;
    nodemailer.createTransport = () => ({
      sendMail: async (options: { subject: string; html: string }) => {
        captured = options;
        return { messageId: "test", rejected: [] };
      },
    });
    try {
      await sendOpportunityDeadlinesDigestEmail({
        to: "editor@example.test",
        name: "Editor",
        report: {
          closingSoon: [],
          openingSoon: [],
          keyDates: [],
          closedButLive: [],
          checkOverdue: [],
          checkDueSoon: [],
          neverVerifiedDrafts: 0,
          manualChecks: [],
          autoApprovals: [
            { title: "Scheme <A>", action: "published", submissionId: "abc123" },
            { title: "Scheme B", action: "reverified", submissionId: "def456" },
          ],
        },
        reviewUrl: "https://admin.example/admin/opportunities",
        adminUrl: "https://admin.example",
        today: "2026-10-15",
      });
    } finally {
      nodemailer.createTransport = original;
    }

    assert.ok(captured, "the email was sent");
    const { subject, html } = captured as unknown as { subject: string; html: string };
    assert.match(subject, /2 approved by the AI/);
    assert.ok(html.includes("Approved by the AI this week (2)"));
    assert.ok(html.includes("https://admin.example/admin/opportunities/sources/abc123"));
    assert.ok(html.includes("https://admin.example/admin/opportunities/sources/def456"));
    assert.ok(html.includes("Published a new entry"));
    assert.ok(html.includes("Confirmed it is still right"));
    assert.ok(html.includes("Scheme &lt;A&gt;"), "escapes the title");
    assert.ok(!html.includes("Scheme <A>"));
    assert.ok(html.includes("you can revert it there"));
  });
});
