/* eslint-disable @typescript-eslint/no-var-requires */
// An entry drafted automatically must lead back to the reading it came from, or an
// editor has nothing to check it against. The list marks it while nobody has.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { DataSourceSubmission } = require("../shared/models/DataSourceSubmission");
const { Opportunity } = require("../shared/models/Opportunity");
const {
  getAdminOpportunity,
  listAdminOpportunities,
} = require("../admin/controllers/opportunityAdminController");

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

const entry = (slug: string, over: Record<string, unknown> = {}) =>
  Opportunity.create({
    slug,
    track: "admission",
    category: "academy",
    title: `Scheme ${slug}`,
    status: "draft",
    ...over,
  });

const drafted = (slug: string, label = "The source page") =>
  DataSourceSubmission.create({
    targetType: "OPPORTUNITY",
    sportSlug: "football",
    sourceKind: "LINK",
    sourceUrl: "https://example.org/x",
    sourceLabel: label,
    status: "APPROVED",
    autoDraft: true,
    draftedSlug: slug,
    submittedBy: new mongoose.Types.ObjectId(),
  });

const call = async (handler: (...args: unknown[]) => unknown, req: unknown) => {
  let body: { data?: any } | undefined;
  const res = {
    status() {
      return res;
    },
    json(value: typeof body) {
      body = value;
      return res;
    },
  };
  await new Promise<void>((resolve) => {
    const result = handler(req, res, () => resolve()) as Promise<void>;
    Promise.resolve(result).then(() => resolve());
  });
  return body?.data;
};

describe("the entry list", () => {
  it("marks an automatic draft nobody has checked, and only that", async () => {
    await entry("auto");
    await drafted("auto");
    await entry("plain-draft");
    await entry("auto-but-verified", { lastVerifiedOn: "2026-10-01" });
    await drafted("auto-but-verified");
    await entry("auto-but-live", { status: "published", lastVerifiedOn: "2026-10-01" });
    await drafted("auto-but-live");

    const rows = await call(listAdminOpportunities, {});
    const marked = Object.fromEntries(
      rows.map((row: { slug: string; autoDrafted: boolean }) => [row.slug, row.autoDrafted])
    );
    assert.deepEqual(marked, {
      auto: true,
      "plain-draft": false,
      "auto-but-verified": false,
      "auto-but-live": false,
    });
  });
});

describe("one entry", () => {
  it("points an automatic draft at the reading it came from", async () => {
    const doc = await entry("auto");
    const submission = await drafted("auto", "Foundation page");
    const data = await call(getAdminOpportunity, { params: { id: String(doc._id) } });
    assert.deepEqual(data.draftedFrom, {
      submissionId: String(submission._id),
      label: "Foundation page",
    });
    assert.equal(data.slug, "auto", "the entry itself is unchanged");
  });

  it("has no pointer for an entry a person made", async () => {
    const doc = await entry("by-hand");
    const data = await call(getAdminOpportunity, { params: { id: String(doc._id) } });
    assert.equal(data.draftedFrom, null);
  });

  it("is not confused by another entry's draft", async () => {
    await entry("other");
    await drafted("other");
    const doc = await entry("mine");
    const data = await call(getAdminOpportunity, { params: { id: String(doc._id) } });
    assert.equal(data.draftedFrom, null);
  });
});
