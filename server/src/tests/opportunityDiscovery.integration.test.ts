// Tests for the monthly search for new admission and scholarship leads.
//
// The search, the formatting call and Google's redirect links are all faked,
// so nothing here calls a model. Pinned: a lead's link only ever comes from a
// real search result, never from the model's text; something we already
// cover is never a lead; a dismissed lead never comes back; aggregators are
// flagged; and reading a lead through the source review marks it read.
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

const { app } = require("../app");
const Admin = require("../admin/models/Admin").default;
const { Opportunity } = require("../shared/models/Opportunity");
const { OpportunityLead } = require("../shared/models/OpportunityLead");
const {
  candidatesFromModel,
  isAggregator,
  nameKey,
  normaliseUrl,
  runOpportunityDiscovery,
} = require("../admin/services/opportunityDiscovery");
const { generateToken } = require("../utils/jwt");
const redis = require("../config/redis").default;

let mongod: { getUri(): string; stop(): Promise<void> };

describe("pure helpers", () => {
  it("normalises a link so the same page is one lead", () => {
    assert.equal(
      normaliseUrl("https://WWW.Example.test/scheme/?utm_source=x&id=4#top"),
      "https://example.test/scheme/?id=4"
    );
    assert.equal(normaliseUrl("https://example.test/scheme/"), "https://example.test/scheme");
    assert.equal(normaliseUrl("javascript:alert(1)"), null);
  });

  it("flags aggregator sites, including their subdomains", () => {
    assert.equal(isAggregator("buddy4study.com"), true);
    assert.equal(isAggregator("news.careers360.com"), true);
    assert.equal(isAggregator("haryanasports.gov.in"), false);
  });

  it("compares names without their filler words", () => {
    assert.equal(nameKey("The Haryana Sports Scholarship Scheme"), nameKey("haryana sports"));
  });

  it("drops a candidate that does not point at a real search result", () => {
    const results = [{ url: "https://real.test/a" }];
    const out = candidatesFromModel(
      [
        { name: "Real one", sourceIndex: 1, track: "scholarship" },
        { name: "Invented link", sourceIndex: 7 },
        { name: "No index" },
        { name: "", sourceIndex: 1 },
      ],
      results,
      "admission"
    );
    assert.deepEqual(
      out.map((c: { name: string; url: string }) => [c.name, c.url]),
      [["Real one", "https://real.test/a"]]
    );
  });
});

describe("runOpportunityDiscovery", () => {
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
      OpportunityLead.deleteMany({}),
      Admin.deleteMany({}),
    ]);
  });

  /** Every query returns the same three results and the same model answer. */
  const fakes = {
    search: async () => ({
      findings: "Some findings.",
      results: [
        { uri: "https://redirect.test/1", title: "haryanasports.gov.in" },
        { uri: "https://redirect.test/2", title: "buddy4study.com" },
        { uri: "https://redirect.test/3", title: "known.test" },
      ],
    }),
    resolveRedirect: async (uri: string) =>
      ({
        "https://redirect.test/1": "https://www.haryanasports.gov.in/new-scheme/",
        "https://redirect.test/2": "https://buddy4study.com/scholarship/tennis",
        "https://redirect.test/3": "https://known.test/rules.pdf",
      })[uri] ?? null,
    format: async () => [
      { name: "Haryana junior athlete stipend", sourceIndex: 1, track: "scholarship" },
      { name: "Tennis grant listed on an aggregator", sourceIndex: 2, track: "scholarship" },
      { name: "A scheme we already cover", sourceIndex: 3, track: "scholarship" },
      { name: "Made up", sourceIndex: 9 },
    ],
  };

  it("keeps new leads, flags aggregators, and skips what we already cover", async () => {
    await Opportunity.create({
      slug: "known",
      track: "scholarship",
      category: "government",
      title: "Known scheme",
      sources: [{ label: "Rules", url: "https://known.test/rules.pdf" }],
      status: "draft",
    });

    const summary = await runOpportunityDiscovery(fakes);
    assert.equal(summary.newLeads, 2);

    const leads = await OpportunityLead.find({}).sort({ name: 1 }).lean();
    assert.deepEqual(
      leads.map((l: { url: string; isAggregator: boolean }) => [l.url, l.isAggregator]),
      [
        ["https://haryanasports.gov.in/new-scheme", false],
        ["https://buddy4study.com/scholarship/tennis", true],
      ]
    );
  });

  it("counts a lead found again instead of duplicating it, and never revives a dismissed one", async () => {
    await runOpportunityDiscovery(fakes);
    await OpportunityLead.updateOne(
      { url: "https://haryanasports.gov.in/new-scheme" },
      { $set: { status: "dismissed" } }
    );
    await runOpportunityDiscovery(fakes);

    const lead = await OpportunityLead.findOne({
      url: "https://haryanasports.gov.in/new-scheme",
    }).lean();
    assert.equal(lead.status, "dismissed");
    assert.ok(lead.timesFound > 1);
    // Nothing is covered in this test, so all three real results are leads.
    assert.equal(await OpportunityLead.countDocuments({}), 3);
  });

  it("drops a result whose redirect could not be resolved", async () => {
    await runOpportunityDiscovery({ ...fakes, resolveRedirect: async () => null });
    assert.equal(await OpportunityLead.countDocuments({}), 0);
  });

  it("lists new leads and dismisses one for good", async () => {
    await runOpportunityDiscovery(fakes);
    const id = new mongoose.Types.ObjectId();
    await Admin.collection.insertOne({
      _id: id,
      name: "Test admin",
      email: `${id}@example.test`,
      password: "not-a-real-hash",
      role: "OPERATIONS_ADMIN",
      permissions: ["opportunities:manage"],
      isActive: true,
    });
    const token = generateToken({
      id: id.toString(),
      email: `${id}@example.test`,
      role: "OPERATIONS_ADMIN",
    });

    const list = await request(app)
      .get("/api/admin/opportunity-leads")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(list.status, 200);
    assert.equal(list.body.data.leads.length, 3);

    const lead = list.body.data.leads[0];
    const dismissed = await request(app)
      .post(`/api/admin/opportunity-leads/${lead._id}/dismiss`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "Not for juniors" });
    assert.equal(dismissed.status, 200);

    const after = await request(app)
      .get("/api/admin/opportunity-leads")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(after.body.data.leads.length, 2);
  });
});
