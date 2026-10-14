/* eslint-disable @typescript-eslint/no-var-requires */
// "Draft it": a lead becomes a populated DRAFT entry with nobody in the loop.
// What these guard is what it must never do: publish, claim a person checked it,
// make a second entry for a scheme we already have, or cite an aggregator.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";
process.env.GEMINI_API_KEY = "";
process.env.GOOGLE_API_KEY = "";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { DataSourceSubmission } = require("../shared/models/DataSourceSubmission");
const { Opportunity } = require("../shared/models/Opportunity");
const { OpportunityLead } = require("../shared/models/OpportunityLead");
const { createDraftFromSubmission } = require("../admin/services/opportunityAutoDraft");
const { draftFromLead } = require("../admin/services/opportunityLeadDraft");
const { runOpportunityExtraction } = require("../admin/services/opportunitySourceSubmission");
const { getOpportunitySource } = require("../admin/controllers/opportunitySourceAdminController");

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
  await Promise.all([
    DataSourceSubmission.deleteMany({}),
    Opportunity.deleteMany({}),
    OpportunityLead.deleteMany({}),
  ]);
});

const EXTRACTED = {
  title: "Khelo Football Trials",
  category: "academy",
  summary: "City trials that connect young footballers to clubs.",
  owner: { name: "Khelo Football", type: "company" },
  sports: ["football"],
  geography: { scope: "india" },
  selection: "trials",
  eligibility: { summary: "Aspiring footballers" },
  benefit: { summary: "A route to clubs and scouts." },
  cost: { kind: "fee", amount: 125, currency: "INR", note: "City round" },
  steps: ["Register", "Play the trial"],
};

const seedSubmission = (over: Record<string, unknown> = {}) =>
  DataSourceSubmission.create({
    targetType: "OPPORTUNITY",
    sportSlug: "football",
    opportunityTrack: "admission",
    sourceLabel: "Khelo Football trials",
    sourceKind: "LINK",
    sourceUrl: "https://example.org/trials",
    autoDraft: true,
    status: "PENDING_REVIEW",
    extractedData: EXTRACTED,
    submittedBy: ADMIN_ID,
    ...over,
  });

describe("createDraftFromSubmission", () => {
  it("writes what was read into a new draft, cited to its source", async () => {
    const submission = await seedSubmission();
    const made = await createDraftFromSubmission(submission);
    assert.equal(made.ok, true);

    const entry = await Opportunity.findOne({ slug: made.slug }).lean();
    assert.equal(entry.status, "draft");
    assert.equal(entry.title, "Khelo Football Trials");
    assert.deepEqual(entry.cost, { kind: "fee", amount: 125, currency: "INR", note: "City round" });
    assert.equal(entry.eligibility.summary, "Aspiring footballers");
    assert.deepEqual(
      entry.sources.map((s: { label: string; url: string }) => [s.label, s.url]),
      [["Khelo Football trials", "https://example.org/trials"]]
    );
  });

  it("never marks it verified or publishes it, because nobody has checked it", async () => {
    const submission = await seedSubmission({
      extractedData: { ...EXTRACTED, lastVerifiedOn: "2026-10-01", status: "published" },
    });
    const made = await createDraftFromSubmission(submission);
    const entry = await Opportunity.findOne({ slug: made.slug }).lean();
    assert.equal(entry.status, "draft");
    assert.equal(entry.lastVerifiedOn, undefined);
    assert.equal(entry.publishedAt ?? null, null);
  });

  it("records on the submission that it was drafted, and that nobody has reviewed it", async () => {
    const submission = await seedSubmission();
    const made = await createDraftFromSubmission(submission);
    const after = await DataSourceSubmission.findById(submission._id).lean();
    assert.equal(after.status, "APPROVED");
    assert.equal(after.autoDraft, true);
    assert.equal(after.draftedSlug, made.slug);
    assert.match(after.reviewNotes, /Nobody has checked it/);
    assert.equal(after.reviewedBy, undefined);
  });

  it("makes nothing when no title or section was read", async () => {
    const submission = await seedSubmission({ extractedData: { summary: "Only a summary." } });
    const made = await createDraftFromSubmission(submission);
    assert.equal(made.ok, false);
    assert.match(made.reason, /title or section/);
    assert.equal(await Opportunity.countDocuments({}), 0);
  });

  it("makes no second entry for a title we already have", async () => {
    await Opportunity.create({
      slug: "khelo-football-trials",
      track: "admission",
      category: "academy",
      title: "Khelo  football TRIALS",
      status: "published",
    });
    const submission = await seedSubmission();
    const made = await createDraftFromSubmission(submission);
    assert.equal(made.ok, false);
    assert.match(made.reason, /already exists/);
    assert.equal(await Opportunity.countDocuments({}), 1);
  });

  it("makes nothing from fields that would not be a valid entry", async () => {
    const submission = await seedSubmission({
      extractedData: { ...EXTRACTED, eligibility: { ageMin: 18, ageMax: 10 } },
    });
    const made = await createDraftFromSubmission(submission);
    assert.equal(made.ok, false);
    assert.match(made.reason, /not be a valid entry/);
    assert.equal(await Opportunity.countDocuments({}), 0);
  });

  it("finds a free address when the title's is taken by a different title", async () => {
    await Opportunity.create({
      slug: "khelo-football-trials",
      track: "admission",
      category: "academy",
      title: "Something else entirely",
      status: "draft",
    });
    const made = await createDraftFromSubmission(await seedSubmission());
    assert.equal(made.ok, true);
    assert.equal(made.slug, "khelo-football-trials-2");
  });
});

describe("runOpportunityExtraction with autoDraft", () => {
  const read = (data: Record<string, unknown>) => async () => ({
    status: "PENDING_REVIEW",
    extractedData: data,
    citations: {},
    extractionModel: "test",
  });

  it("creates the draft as soon as the reading is done", async () => {
    const submission = await seedSubmission({
      status: "PENDING_EXTRACTION",
      extractedData: undefined,
    });
    await runOpportunityExtraction(submission, { extract: read(EXTRACTED) });
    const after = await DataSourceSubmission.findById(submission._id).lean();
    assert.equal(after.status, "APPROVED");
    assert.equal(await Opportunity.countDocuments({ status: "draft" }), 1);
  });

  it("leaves it in the review queue, with the reason, when it cannot draft", async () => {
    const submission = await seedSubmission({
      status: "PENDING_EXTRACTION",
      extractedData: undefined,
    });
    await runOpportunityExtraction(submission, { extract: read({ summary: "No title." }) });
    const after = await DataSourceSubmission.findById(submission._id).lean();
    assert.equal(after.status, "PENDING_REVIEW");
    assert.match(after.reviewNotes, /Could not draft this automatically/);
    assert.equal(await Opportunity.countDocuments({}), 0);
  });

  it("does nothing automatic for an ordinary reading", async () => {
    const submission = await seedSubmission({
      status: "PENDING_EXTRACTION",
      extractedData: undefined,
      autoDraft: undefined,
    });
    await runOpportunityExtraction(submission, { extract: read(EXTRACTED), notify: false });
    const after = await DataSourceSubmission.findById(submission._id).lean();
    assert.equal(after.status, "PENDING_REVIEW");
    assert.equal(await Opportunity.countDocuments({}), 0);
  });

  it("does not draft from a reading that failed", async () => {
    const submission = await seedSubmission({
      status: "PENDING_EXTRACTION",
      extractedData: undefined,
    });
    await runOpportunityExtraction(submission, {
      extract: async () => ({ status: "EXTRACTION_FAILED", extractionError: "503" }),
    });
    const after = await DataSourceSubmission.findById(submission._id).lean();
    assert.equal(after.status, "EXTRACTION_FAILED");
    assert.equal(await Opportunity.countDocuments({}), 0);
  });
});

describe("draftFromLead", () => {
  const lead = (over: Record<string, unknown> = {}) =>
    OpportunityLead.create({
      name: "Khelo Football Trials",
      owner: "Khelo Football",
      track: "admission",
      url: "https://example.org/trials",
      domain: "example.org",
      isAggregator: false,
      query: "football trials",
      sportSlug: "football",
      status: "new",
      firstFoundAt: new Date(),
      lastFoundAt: new Date(),
      timesFound: 1,
      ...over,
    });
  const deps = () => {
    const started: unknown[] = [];
    return { started, deps: { start: (s: unknown) => started.push(s) } };
  };

  it("sets the reading up from what the lead knows and starts it", async () => {
    const found = await lead();
    const { started, deps: d } = deps();
    const submission = await draftFromLead(String(found._id), ADMIN_ID, {}, d);
    assert.equal(submission.autoDraft, true);
    assert.equal(submission.followDocuments, true);
    assert.equal(submission.sourceUrl, "https://example.org/trials");
    assert.equal(submission.sourceLabel, "Khelo Football Trials");
    assert.equal(submission.opportunityTrack, "admission");
    assert.equal(started.length, 1);

    const after = await OpportunityLead.findById(found._id).lean();
    assert.equal(after.status, "read");
    assert.equal(String(after.submissionId), String(submission._id));
  });

  it("will not read a lead twice, or one that was dismissed", async () => {
    const { deps: d } = deps();
    const read = await lead({ status: "read" });
    const dismissed = await lead({ status: "dismissed", url: "https://example.org/other" });
    await assert.rejects(
      () => draftFromLead(String(read._id), ADMIN_ID, {}, d),
      /already been read/
    );
    await assert.rejects(() => draftFromLead(String(dismissed._id), ADMIN_ID, {}, d), /dismissed/);
  });

  it("stops at a lead that looks like an entry we have, unless told to go on", async () => {
    const found = await lead({
      triage: {
        by: "rules",
        at: new Date(),
        possibleDuplicateOf: { slug: "khelo-football", title: "Khelo Football" },
      },
    });
    const { started, deps: d } = deps();
    await assert.rejects(
      () => draftFromLead(String(found._id), ADMIN_ID, {}, d),
      (error: { statusCode?: number; message: string }) =>
        error.statusCode === 409 && /already have/.test(error.message)
    );
    assert.equal(started.length, 0);
    assert.equal((await OpportunityLead.findById(found._id).lean()).status, "new");

    await draftFromLead(String(found._id), ADMIN_ID, { force: true }, d);
    assert.equal(started.length, 1);
  });

  it("cites an aggregator's official page, never the aggregator itself", async () => {
    const found = await lead({
      isAggregator: true,
      url: "https://aggregator.example/scheme",
      triage: { by: "ai", at: new Date(), officialUrl: "https://official.example/scheme" },
    });
    const { deps: d } = deps();
    const submission = await draftFromLead(String(found._id), ADMIN_ID, {}, d);
    assert.equal(submission.sourceUrl, "https://official.example/scheme");
  });

  it("refuses an aggregator with no official page found", async () => {
    const found = await lead({ isAggregator: true, url: "https://aggregator.example/scheme" });
    const { started, deps: d } = deps();
    await assert.rejects(
      () => draftFromLead(String(found._id), ADMIN_ID, {}, d),
      (error: { statusCode?: number }) => error.statusCode === 400
    );
    assert.equal(started.length, 0);
  });

  it("falls back to the default sport when the lead's is not one we support", async () => {
    const found = await lead({ sportSlug: "curling" });
    const { deps: d } = deps();
    const submission = await draftFromLead(String(found._id), ADMIN_ID, {}, d);
    assert.equal(submission.sportSlug, "tennis");
  });
});

describe("the review page for a drafted entry", () => {
  it("shows what was read, with the draft as the entry, not a comparison with it", async () => {
    const submission = await seedSubmission({
      citations: { title: "Khelo Football Trials" },
    });
    const made = await createDraftFromSubmission(submission);

    let body: { data?: Record<string, any> } | undefined;
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
      const result = getOpportunitySource({ params: { id: String(submission._id) } }, res, () =>
        resolve()
      ) as Promise<void>;
      Promise.resolve(result).then(() => resolve());
    });

    assert.equal(body?.data?.drafted, true);
    assert.equal(body?.data?.entry.slug, made.slug);
    const paths = body?.data?.changes.map((c: { path: string }) => c.path);
    assert.ok(paths.includes("title"), "the title is shown as read");
    assert.ok(paths.includes("cost"), "the cost is shown as read");
  });
});

describe("guards on what a reading came back as", () => {
  it("makes no draft when the source describes a different scheme from the lead", async () => {
    const submission = await seedSubmission({
      sourceLabel: "Murugappa Raising Talent Sports Scholarship (MRTSS)",
      extractedData: { ...EXTRACTED, title: "AMM Murugappa Chettiar Centenary Scholarship" },
    });
    const made = await createDraftFromSubmission(submission);
    assert.equal(made.ok, false);
    assert.match(made.reason, /does not match the lead/);
    assert.equal(await Opportunity.countDocuments({}), 0);
  });

  it("makes no draft from rules for a year that is over", async () => {
    const submission = await seedSubmission({
      extractedData: { ...EXTRACTED, cycle: { label: "2021-22" } },
    });
    const made = await createDraftFromSubmission(submission);
    assert.equal(made.ok, false);
    assert.match(made.reason, /2021-22.*out of date/);
    assert.equal(await Opportunity.countDocuments({}), 0);
  });

  it("makes no draft from a document years old", async () => {
    const submission = await seedSubmission({
      extractedData: { ...EXTRACTED, sourcePublishedOn: "2021-12-03" },
    });
    const made = await createDraftFromSubmission(submission);
    assert.equal(made.ok, false);
    assert.match(made.reason, /from 2021/);
  });

  it("still drafts a current reading that matches its lead", async () => {
    const year = new Date().getUTCFullYear();
    const submission = await seedSubmission({
      extractedData: { ...EXTRACTED, cycle: { label: `${year}-${String(year + 1).slice(2)}` } },
    });
    const made = await createDraftFromSubmission(submission);
    assert.equal(made.ok, true);
  });

  it("leaves a refused reading in the review queue, with why, and tells the editors", async () => {
    const submission = await seedSubmission({
      status: "PENDING_EXTRACTION",
      extractedData: undefined,
      sourceLabel: "Murugappa Raising Talent Sports Scholarship",
    });
    await runOpportunityExtraction(submission, {
      extract: async () => ({
        status: "PENDING_REVIEW",
        extractedData: { ...EXTRACTED, title: "AMM Murugappa Chettiar Centenary Scholarship" },
        citations: {},
        extractionModel: "test",
      }),
    });
    const after = await DataSourceSubmission.findById(submission._id).lean();
    assert.equal(after.status, "PENDING_REVIEW");
    assert.match(after.reviewNotes, /Could not draft this automatically.*does not match/);
  });
});

describe("what the reading is told to look for", () => {
  const seen = async (over: Record<string, unknown>) => {
    const submission = await seedSubmission({
      status: "PENDING_EXTRACTION",
      extractedData: undefined,
      ...over,
    });
    let focus: unknown = "unset";
    await runOpportunityExtraction(submission, {
      notify: false,
      extract: async (_submission: unknown, title: unknown) => {
        focus = title;
        return { status: "EXTRACTION_FAILED", extractionError: "stop here" };
      },
    });
    return focus;
  };

  it("is the lead's name, for a reading made from a lead", async () => {
    assert.equal(
      await seen({ sourceLabel: "Murugappa Raising Talent Sports Scholarship" }),
      "Murugappa Raising Talent Sports Scholarship"
    );
  });

  it("is the entry, for a reading that checks an existing entry", async () => {
    await Opportunity.create({
      slug: "ikf",
      track: "admission",
      category: "academy",
      title: "India Khelo Football",
      status: "published",
    });
    assert.equal(
      await seen({ opportunitySlug: "ikf", autoDraft: undefined }),
      "India Khelo Football"
    );
  });

  it("is nothing for an ordinary reading of a new entry, as before", async () => {
    assert.equal(await seen({ autoDraft: undefined }), undefined);
  });
});
