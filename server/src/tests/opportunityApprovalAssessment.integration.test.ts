/* eslint-disable @typescript-eslint/no-var-requires */
// What the approval rules make of real readings, against a real (in-memory)
// database: a live entry the source confirms, a small update, a change to what an
// entry is, a new entry from an official and from an unofficial site, and a draft
// made automatically. Nothing here writes; assessing only reads.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";
process.env.OPPORTUNITY_TRUSTED_DOMAINS = "";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { DataSourceSubmission } = require("../shared/models/DataSourceSubmission");
const { Opportunity } = require("../shared/models/Opportunity");
const { assessSubmission } = require("../admin/services/opportunityApprovalAssessment");

let memoryServer: { getUri(): string; stop(): Promise<void> };
const ADMIN_ID = new mongoose.Types.ObjectId().toString();

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

const YEAR = new Date().getUTCFullYear();
const CYCLE = `${YEAR}-${String(YEAR + 1).slice(2)}`;

/** A complete, publishable entry. */
const ENTRY = {
  slug: "khelo-football",
  track: "admission",
  category: "academy",
  title: "Khelo Football Trials",
  summary: "City trials that connect young footballers to clubs.",
  owner: { name: "India Khelo Football", type: "company" },
  sports: ["football"],
  allSports: false,
  geography: { scope: "india" },
  selection: "trials",
  eligibility: { gender: "any", summary: "Aspiring footballers" },
  benefit: { summary: "A route to clubs and scouts." },
  cost: { kind: "fee", amount: 125, currency: "INR", note: "City round" },
  cycle: { label: CYCLE, closesOn: `${YEAR + 1}-03-01`, keyDates: [] },
  steps: ["Register", "Play the trial"],
  keyFacts: [],
  sources: [{ label: "Trials", url: "https://indiakhelofootball.com/trials" }],
  lastVerifiedOn: `${YEAR}-01-01`,
  status: "published",
};

const seedEntry = (over: Record<string, unknown> = {}) => Opportunity.create({ ...ENTRY, ...over });

/** Quotes found for every top-level field, and figures ok where there is one. */
const evidenceFor = (fields: Record<string, unknown>) => {
  const citations: Record<string, string> = {};
  const quotes: Record<string, string> = {};
  for (const key of Object.keys(fields)) {
    citations[key] = `quote for ${key}`;
    quotes[key] = "found";
  }
  const figures: Record<string, string> = {};
  if (fields.cost) figures.cost = "ok";
  if ((fields.cycle as Record<string, unknown> | undefined)?.closesOn)
    figures["cycle.closesOn"] = "ok";
  return { citations, citationChecks: { against: "page-text", quotes, figures, shared: {} } };
};

const READING = {
  title: ENTRY.title,
  category: ENTRY.category,
  summary: ENTRY.summary,
  owner: ENTRY.owner,
  sports: ENTRY.sports,
  geography: ENTRY.geography,
  selection: ENTRY.selection,
  eligibility: ENTRY.eligibility,
  benefit: ENTRY.benefit,
  cost: ENTRY.cost,
  cycle: { label: CYCLE, closesOn: `${YEAR + 1}-03-01` },
  steps: ENTRY.steps,
};

const seedSubmission = (data: Record<string, unknown>, over: Record<string, unknown> = {}) =>
  DataSourceSubmission.create({
    targetType: "OPPORTUNITY",
    sportSlug: "football",
    opportunityTrack: "admission",
    sourceLabel: "Khelo Football trials",
    sourceKind: "LINK",
    sourceUrl: "https://indiakhelofootball.com/trials",
    status: "PENDING_REVIEW",
    extractedData: data,
    submittedBy: ADMIN_ID,
    ...evidenceFor(data),
    ...over,
  });

describe("a live entry the source confirms", () => {
  it("passes, and is recognised as unchanged, so approving it only re-verifies", async () => {
    await seedEntry();
    const verdict = await assessSubmission(
      await seedSubmission(READING, { opportunitySlug: "khelo-football" })
    );
    assert.equal(verdict.kind, "update");
    assert.equal(verdict.unchanged, true);
    assert.equal(verdict.pass, true, verdict.failed.join(", "));
  });

  it("does not pass unchanged when the evidence for what it confirms is missing", async () => {
    await seedEntry();
    const verdict = await assessSubmission(
      await seedSubmission(READING, {
        opportunitySlug: "khelo-football",
        citations: {},
        citationChecks: { against: "none", quotes: {}, figures: {}, shared: {} },
      })
    );
    assert.equal(verdict.unchanged, true);
    assert.equal(verdict.pass, false);
    assert.ok(verdict.failed.includes("every-field-quoted"));
    assert.ok(verdict.failed.includes("quotes-verified"));
  });
});

describe("an update to a live entry", () => {
  it("passes a small, evidenced change", async () => {
    await seedEntry();
    const data = { ...READING, cycle: { label: CYCLE, closesOn: `${YEAR + 1}-03-15` } };
    const verdict = await assessSubmission(
      await seedSubmission(data, { opportunitySlug: "khelo-football" })
    );
    assert.equal(verdict.unchanged, false);
    assert.equal(verdict.rows, 1);
    assert.equal(verdict.pass, true, verdict.failed.join(", "));
  });

  it("holds a change to what the entry is", async () => {
    await seedEntry();
    const verdict = await assessSubmission(
      await seedSubmission(
        { ...READING, title: "A Different Scheme" },
        { opportunitySlug: "khelo-football" }
      )
    );
    assert.ok(verdict.failed.includes("identity-stable"));
    assert.equal(verdict.pass, false);
  });

  it("holds a fee that more than doubles", async () => {
    await seedEntry();
    const data = { ...READING, cost: { kind: "fee", amount: 900, currency: "INR" } };
    const verdict = await assessSubmission(
      await seedSubmission(data, { opportunitySlug: "khelo-football" })
    );
    assert.ok(verdict.failed.includes("no-big-swing"));
  });

  it("holds an update whose quote only partly matched", async () => {
    await seedEntry();
    const data = { ...READING, summary: "A rewritten summary." };
    const submission = await seedSubmission(data, { opportunitySlug: "khelo-football" });
    submission.citationChecks = {
      against: "page-text",
      quotes: { ...evidenceFor(data).citationChecks.quotes, summary: "partial" },
      figures: { cost: "ok", "cycle.closesOn": "ok" },
      shared: {},
    };
    const verdict = await assessSubmission(submission);
    assert.ok(verdict.failed.includes("quotes-verified"));
  });
});

describe("a new entry from a source", () => {
  it("passes when the source is the organiser's own and everything is evidenced", async () => {
    const verdict = await assessSubmission(await seedSubmission(READING));
    assert.equal(verdict.kind, "new");
    assert.equal(verdict.pass, true, verdict.failed.join(", "));
  });

  it("holds one cited to a site that is not the organiser's", async () => {
    const verdict = await assessSubmission(
      await seedSubmission(READING, { sourceUrl: "https://some-blog.example/post" })
    );
    assert.deepEqual(verdict.failed, ["official-source"]);
  });

  it("holds one for a year that is over", async () => {
    const data = { ...READING, cycle: { label: "2021-22" } };
    const verdict = await assessSubmission(await seedSubmission(data));
    assert.ok(verdict.failed.includes("current"));
  });

  it("holds a duplicate of an entry we have", async () => {
    await seedEntry({ slug: "other", title: "Khelo  football TRIALS" });
    const verdict = await assessSubmission(await seedSubmission(READING));
    assert.ok(verdict.failed.includes("right-scheme"));
  });

  it("holds one that would not be complete enough to publish", async () => {
    const { steps: _s, selection: _sel, ...incomplete } = READING;
    const verdict = await assessSubmission(await seedSubmission(incomplete));
    assert.ok(verdict.failed.includes("complete"));
  });
});

describe("a draft made automatically", () => {
  it("is judged as the new entry it is, on the whole reading", async () => {
    await seedEntry({ slug: "khelo-football-draft", status: "draft", lastVerifiedOn: undefined });
    const submission = await seedSubmission(READING, {
      status: "APPROVED",
      autoDraft: true,
      draftedSlug: "khelo-football-draft",
    });
    const verdict = await assessSubmission(submission);
    assert.equal(verdict.kind, "new");
    assert.equal(verdict.pass, true, verdict.failed.join(", "));
  });

  it("is held when the title read does not match the lead", async () => {
    await seedEntry({
      slug: "khelo-football-draft",
      status: "draft",
      title: "Murugappa Chettiar Centenary Scholarship",
    });
    const submission = await seedSubmission(
      { ...READING, title: "Murugappa Chettiar Centenary Scholarship" },
      {
        status: "APPROVED",
        autoDraft: true,
        draftedSlug: "khelo-football-draft",
        sourceLabel: "Murugappa Raising Talent Sports Scholarship",
      }
    );
    const verdict = await assessSubmission(submission);
    assert.ok(verdict.failed.includes("right-scheme"));
  });
});

describe("what it will not judge", () => {
  it("returns nothing for a reading still being read, a failed one, or one a person already decided", async () => {
    for (const status of ["PENDING_EXTRACTION", "EXTRACTION_FAILED", "REJECTED", "APPROVED"]) {
      const submission = await seedSubmission(READING, { status });
      assert.equal(await assessSubmission(submission), null, status);
    }
  });

  it("writes nothing", async () => {
    await seedEntry();
    const before = await Opportunity.findOne({ slug: "khelo-football" }).lean();
    await assessSubmission(await seedSubmission(READING, { opportunitySlug: "khelo-football" }));
    const after = await Opportunity.findOne({ slug: "khelo-football" }).lean();
    assert.deepEqual(after, before);
    assert.equal(await Opportunity.countDocuments({}), 1);
  });
});
