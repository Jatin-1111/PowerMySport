// Tests for sorting the month's leads (opportunityLeadTriage.ts), against an
// in-memory database. No model is ever called: judging and the official-page
// lookup are injected.
//
// Pinned: a social media post is dismissed by rule; an AI "none" is dismissed
// only with a reason and only when the batch is believable; everything else is
// labelled and left for a person; a possible duplicate is suggested and never
// dismisses; a restored lead is locked against being dismissed again; and a bad
// or missing answer leaves leads untriaged to try again.
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
  MAX_OFFICIAL_LOOKUPS_PER_RUN,
  guardDismissals,
  isSocialDomain,
  leadTriageEnabled,
  parseJudgements,
  possibleDuplicate,
  runLeadTriage,
} = require("../admin/services/opportunityLeadTriage");
const { runOpportunityDiscovery } = require("../admin/services/opportunityDiscovery");
const { generateToken } = require("../utils/jwt");
const redis = require("../config/redis").default;

let mongod: { getUri(): string; stop(): Promise<void> };

type Fit = "high" | "medium" | "low" | "none";

/** A model answer for the leads in the order the prompt listed them. */
const answer = (fits: Array<[Fit, string]>) =>
  fits.map(([fit, reason], i) => ({ id: i + 1, fit, reason }));

let counter = 0;
const seedLead = (over: Record<string, unknown> = {}) => {
  counter += 1;
  const domain = (over.domain as string) ?? `site${counter}.test`;
  return OpportunityLead.create({
    name: `Lead ${counter}`,
    track: "scholarship",
    url: `https://${domain}/page-${counter}`,
    domain,
    query: "q",
    status: "new",
    firstFoundAt: new Date(),
    lastFoundAt: new Date(Date.now() - counter * 1000),
    ...over,
  });
};

describe("pure helpers", () => {
  it("recognises social media, including subdomains", () => {
    assert.equal(isSocialDomain("facebook.com"), true);
    assert.equal(isSocialDomain("m.facebook.com"), true);
    assert.equal(isSocialDomain("notfacebook.com"), false);
    assert.equal(isSocialDomain("haryanasports.gov.in"), false);
  });

  it("suggests a duplicate on strong word overlap, and stays quiet otherwise", () => {
    const entries = [
      { slug: "khelo-india", title: "Khelo India athlete scholarship" },
      { slug: "du-quota", title: "Delhi University sports quota" },
    ];
    assert.equal(
      possibleDuplicate("Khelo India Scholarship Scheme for athletes", entries)?.slug,
      "khelo-india"
    );
    assert.equal(possibleDuplicate("Haryana junior stipend", entries), null);
    assert.equal(possibleDuplicate("Khelo", entries), null, "one word is not enough to suggest");
  });

  it("keeps only well-formed judgements that carry a reason", () => {
    const parsed = parseJudgements(
      [
        { id: 1, fit: "high", reason: "Official scheme." },
        { id: 2, fit: "maybe", reason: "Bad fit value." },
        { id: 3, fit: "none", reason: "" },
        { id: 9, fit: "low", reason: "Out of range." },
        "junk",
      ],
      3
    );
    assert.deepEqual([...parsed.keys()], [1]);
  });

  it("refuses to dismiss when most of a batch is called none", () => {
    const none = new Map([1, 2, 3, 4].map((n) => [n, { fit: "none", reason: "x" }]));
    assert.equal(guardDismissals(none, 4), false);
    const some = new Map([[1, { fit: "none", reason: "x" }]]);
    assert.equal(guardDismissals(some, 4), true);
    assert.equal(guardDismissals(new Map([[1, { fit: "none", reason: "x" }]]), 2), true);
  });

  it("is on in production, off elsewhere, and either can be overridden", () => {
    assert.equal(leadTriageEnabled({ NODE_ENV: "production" }), true);
    assert.equal(leadTriageEnabled({ NODE_ENV: "development" }), false);
    assert.equal(leadTriageEnabled({ OPPORTUNITY_LEAD_TRIAGE: "true" }), true);
    assert.equal(
      leadTriageEnabled({ NODE_ENV: "production", OPPORTUNITY_LEAD_TRIAGE: "false" }),
      false
    );
  });
});

describe("runLeadTriage and the lead endpoints", () => {
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
    counter = 0;
    await Promise.all([
      Opportunity.deleteMany({}),
      OpportunityLead.deleteMany({}),
      Admin.deleteMany({}),
    ]);
  });

  const noOfficial = async () => null;

  it("dismisses a social media post by rule, with its reason, without asking a model", async () => {
    await seedLead({ domain: "facebook.com", name: "A Facebook post" });
    let asked = 0;
    const summary = await runLeadTriage({
      classify: async () => {
        asked += 1;
        return [];
      },
      findOfficial: noOfficial,
    });

    assert.equal(summary.dismissedByRules, 1);
    assert.equal(asked, 0);
    const lead = await OpportunityLead.findOne({}).lean();
    assert.equal(lead.status, "dismissed");
    assert.equal(lead.autoDismissed, true);
    assert.match(lead.dismissReason, /social media/i);
    assert.equal(lead.triage.by, "rules");
  });

  it("dismisses an AI 'none' with its reason, and labels the rest without dismissing them", async () => {
    await seedLead({ name: "Official scheme" });
    await seedLead({ name: "A news item" });
    await seedLead({ name: "Loosely related" });
    await seedLead({ name: "Another scheme" });

    const summary = await runLeadTriage({
      classify: async () =>
        answer([
          ["high", "Official scheme for juniors."],
          ["none", "A news item about something else."],
          ["low", "General information page."],
          ["medium", "Open to Indians."],
        ]),
      findOfficial: noOfficial,
    });

    assert.equal(summary.dismissedByAi, 1);
    assert.equal(summary.labelled, 3);
    const byName = Object.fromEntries(
      (await OpportunityLead.find({}).lean()).map((l: { name: string }) => [l.name, l])
    );
    assert.equal(byName["A news item"].status, "dismissed");
    assert.equal(byName["A news item"].autoDismissed, true);
    assert.equal(byName["A news item"].dismissReason, "A news item about something else.");
    for (const name of ["Official scheme", "Loosely related", "Another scheme"]) {
      assert.equal(byName[name].status, "new");
      assert.notEqual(byName[name].autoDismissed, true);
    }
    assert.equal(byName["Official scheme"].triage.fit, "high");
    assert.equal(byName["Official scheme"].triage.by, "ai");
  });

  it("labels but does not dismiss when most of a batch is called none", async () => {
    for (let i = 0; i < 4; i += 1) await seedLead();

    const summary = await runLeadTriage({
      classify: async () => answer(Array.from({ length: 4 }, () => ["none", "Not relevant."])),
      findOfficial: noOfficial,
    });

    assert.equal(summary.dismissedByAi, 0);
    assert.equal(await OpportunityLead.countDocuments({ status: "dismissed" }), 0);
    const fits = (await OpportunityLead.find({}).lean()).map(
      (l: { triage: { fit: string } }) => l.triage.fit
    );
    assert.deepEqual([...new Set(fits)], ["low"]);
  });

  it("suggests a possible duplicate and never dismisses because of one", async () => {
    await Opportunity.create({
      slug: "khelo-india",
      track: "scholarship",
      category: "government",
      title: "Khelo India athlete scholarship",
      status: "draft",
    });
    await seedLead({ name: "Khelo India Scholarship Scheme for athletes" });

    await runLeadTriage({
      classify: async () => answer([["high", "Official scheme."]]),
      findOfficial: noOfficial,
    });

    const lead = await OpportunityLead.findOne({}).lean();
    assert.equal(lead.status, "new");
    assert.deepEqual(lead.triage.possibleDuplicateOf, {
      slug: "khelo-india",
      title: "Khelo India athlete scholarship",
    });
  });

  it("leaves leads untriaged when the model gives nothing usable, so the next run tries again", async () => {
    await seedLead();
    await seedLead();

    await runLeadTriage({ classify: async () => null, findOfficial: noOfficial });
    assert.equal(await OpportunityLead.countDocuments({ "triage.fit": { $exists: true } }), 0);

    await runLeadTriage({
      classify: async () => {
        throw new Error("quota exceeded");
      },
      findOfficial: noOfficial,
    });
    assert.equal(await OpportunityLead.countDocuments({ "triage.fit": { $exists: true } }), 0);

    await runLeadTriage({
      classify: async () =>
        answer([
          ["high", "A."],
          ["low", "B."],
        ]),
      findOfficial: noOfficial,
    });
    assert.equal(await OpportunityLead.countDocuments({ "triage.fit": { $exists: true } }), 2);
  });

  it("does not look at a lead twice, or at one a person has locked", async () => {
    await seedLead({
      name: "Already sorted",
      triage: { fit: "high", reason: "x", by: "ai", at: new Date() },
    });
    await seedLead({ name: "Locked", triageLocked: true });
    let asked = 0;

    const summary = await runLeadTriage({
      classify: async () => {
        asked += 1;
        return [];
      },
      findOfficial: noOfficial,
    });

    assert.equal(summary.considered, 0);
    assert.equal(asked, 0);
  });

  it("finds the official page behind an aggregator, a few per run", async () => {
    const total = MAX_OFFICIAL_LOOKUPS_PER_RUN + 2;
    for (let i = 0; i < total; i += 1) {
      await seedLead({ domain: "buddy4study.com", isAggregator: true, name: `Listed ${i}` });
    }
    const asked: string[] = [];

    const summary = await runLeadTriage({
      classify: async () => answer(Array.from({ length: total }, () => ["medium", "Listed."])),
      findOfficial: async (lead: { name: string }) => {
        asked.push(lead.name);
        return `https://official.test/${asked.length}`;
      },
    });

    assert.equal(asked.length, MAX_OFFICIAL_LOOKUPS_PER_RUN);
    assert.equal(summary.officialPagesFound, MAX_OFFICIAL_LOOKUPS_PER_RUN);
    assert.equal(
      await OpportunityLead.countDocuments({ "triage.officialUrl": { $exists: true } }),
      MAX_OFFICIAL_LOOKUPS_PER_RUN
    );
  });

  it("is run after a search when there are new leads, and a failure there does not fail the search", async () => {
    const fakes = {
      search: async () => ({
        findings: "Findings.",
        results: [{ uri: "https://redirect.test/1", title: "x.test" }],
      }),
      resolveRedirect: async () => "https://x.test/scheme",
      format: async () => [{ name: "A new scheme", sourceIndex: 1, track: "scholarship" }],
    };
    let calls = 0;
    const summary = await runOpportunityDiscovery({
      ...fakes,
      triage: async () => {
        calls += 1;
        throw new Error("Gemini is down");
      },
    });

    assert.equal(calls, 1);
    assert.equal(summary.newLeads, 1);
    assert.equal(await OpportunityLead.countDocuments({}), 1);

    // Nothing new on a repeat search, so nothing to triage.
    await runOpportunityDiscovery({
      ...fakes,
      triage: async () => {
        calls += 1;
      },
    });
    assert.equal(calls, 1);
  });

  describe("endpoints", () => {
    const signIn = async (permissions = ["opportunities:manage"]) => {
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

    it("lists only automatic dismissals when asked, and restores one with a lock", async () => {
      const token = await signIn();
      await seedLead({ name: "By a person", status: "dismissed" });
      const auto = await seedLead({
        name: "By triage",
        status: "dismissed",
        autoDismissed: true,
        dismissReason: "Not relevant.",
      });

      const all = await request(app)
        .get("/api/admin/opportunity-leads?status=dismissed")
        .set("Authorization", `Bearer ${token}`);
      assert.equal(all.body.data.leads.length, 2);

      const onlyAuto = await request(app)
        .get("/api/admin/opportunity-leads?status=dismissed&autoDismissed=true")
        .set("Authorization", `Bearer ${token}`);
      assert.deepEqual(
        onlyAuto.body.data.leads.map((l: { name: string }) => l.name),
        ["By triage"]
      );

      const restored = await request(app)
        .post(`/api/admin/opportunity-leads/${auto._id}/restore`)
        .set("Authorization", `Bearer ${token}`);
      assert.equal(restored.status, 200);
      const lead = await OpportunityLead.findById(auto._id).lean();
      assert.equal(lead.status, "new");
      assert.equal(lead.triageLocked, true);
      assert.equal(lead.autoDismissed, undefined);
      assert.equal(lead.dismissReason, undefined);

      // Locked, so a later triage run leaves it alone even though it is new.
      const summary = await runLeadTriage({
        classify: async () => answer([["none", "Not relevant."]]),
        findOfficial: noOfficial,
      });
      assert.equal(summary.considered, 0);
    });

    it("will not restore a lead a person dismissed", async () => {
      const token = await signIn();
      const manual = await seedLead({ status: "dismissed" });
      const res = await request(app)
        .post(`/api/admin/opportunity-leads/${manual._id}/restore`)
        .set("Authorization", `Bearer ${token}`);
      assert.equal(res.status, 404);
      assert.equal((await OpportunityLead.findById(manual._id).lean()).status, "dismissed");
    });

    it("needs the manage permission to restore or triage", async () => {
      const token = await signIn(["opportunities:view"]);
      const auto = await seedLead({ status: "dismissed", autoDismissed: true });
      const restore = await request(app)
        .post(`/api/admin/opportunity-leads/${auto._id}/restore`)
        .set("Authorization", `Bearer ${token}`);
      const triage = await request(app)
        .post("/api/admin/opportunity-leads/triage")
        .set("Authorization", `Bearer ${token}`);
      assert.equal(restore.status, 403);
      assert.equal(triage.status, 403);
    });
  });
});
