/* eslint-disable @typescript-eslint/no-var-requires */
// The AI approver, where a mistake reaches parents. What these hold: it does
// nothing unless switched on; any broken rule leaves the item for a person; the
// daily cap and the kill switch bind; every action is recorded, audited and
// reversible; and it goes through the same gate a person does.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";
process.env.GEMINI_API_KEY = "";
process.env.GOOGLE_API_KEY = "";
process.env.OPPORTUNITY_TRUSTED_DOMAINS = "";

import assert = require("node:assert/strict");
const { after, before, beforeEach, afterEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { DataSourceSubmission } = require("../shared/models/DataSourceSubmission");
const { Opportunity } = require("../shared/models/Opportunity");
const { AdminAuditLog } = require("../admin/models/AdminAuditLog");
const {
  considerAutoApproval,
  revertAutoApproval,
  autoApproveEnabled,
  dailyCap,
} = require("../admin/services/opportunityAutoApprover");
const { runOpportunityExtraction } = require("../admin/services/opportunitySourceSubmission");
const { createAutoDiffs } = require("../admin/services/opportunityAutoDiff");
const { createDraftFromSubmission } = require("../admin/services/opportunityAutoDraft");

let memoryServer: { getUri(): string; stop(): Promise<void> };
const ADMIN_ID = new mongoose.Types.ObjectId().toString();
const EDITOR = { id: ADMIN_ID, email: "editor@example.test" };

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
});
after(async () => {
  await mongoose.disconnect();
  await memoryServer.stop();
});
beforeEach(async () => {
  delete process.env.OPPORTUNITY_AUTO_APPROVE;
  delete process.env.OPPORTUNITY_AUTO_APPROVE_DISABLED;
  delete process.env.OPPORTUNITY_AUTO_APPROVE_DAILY_CAP;
  await Promise.all([
    DataSourceSubmission.deleteMany({}),
    Opportunity.deleteMany({}),
    AdminAuditLog.deleteMany({}),
  ]);
});
afterEach(() => {
  delete process.env.OPPORTUNITY_AUTO_APPROVE;
  delete process.env.OPPORTUNITY_AUTO_APPROVE_DISABLED;
  delete process.env.OPPORTUNITY_AUTO_APPROVE_DAILY_CAP;
});

const on = () => {
  process.env.OPPORTUNITY_AUTO_APPROVE = "on";
};

const YEAR = new Date().getUTCFullYear();
const CYCLE = `${YEAR}-${String(YEAR + 1).slice(2)}`;
const { todayInIndia } = require("../shared/validation/opportunityFormat");
// The code stamps India's date, which is not always the UTC date.
const TODAY = todayInIndia();

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

const evidenceFor = (fields: Record<string, unknown>, quoteStatus = "found") => {
  const citations: Record<string, string> = {};
  const quotes: Record<string, string> = {};
  for (const key of Object.keys(fields)) {
    citations[key] = `quote for ${key}`;
    quotes[key] = quoteStatus;
  }
  const figures: Record<string, string> = {};
  if (fields.cost) figures.cost = "ok";
  if ((fields.cycle as Record<string, unknown> | undefined)?.closesOn)
    figures["cycle.closesOn"] = "ok";
  return { citations, citationChecks: { against: "page-text", quotes, figures, shared: {} } };
};

const seedEntry = (over: Record<string, unknown> = {}) => Opportunity.create({ ...ENTRY, ...over });

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

const entryNow = () => Opportunity.findOne({ slug: "khelo-football" }).lean();

describe("the switch", () => {
  it("is off unless explicitly turned on, and the kill switch beats it", () => {
    assert.equal(autoApproveEnabled(), false);
    process.env.OPPORTUNITY_AUTO_APPROVE = "true";
    assert.equal(autoApproveEnabled(), false, "only the word on counts");
    on();
    assert.equal(autoApproveEnabled(), true);
    process.env.OPPORTUNITY_AUTO_APPROVE_DISABLED = "true";
    assert.equal(autoApproveEnabled(), false);
  });

  it("has a daily cap of ten unless configured, and ignores nonsense", () => {
    assert.equal(dailyCap(), 10);
    process.env.OPPORTUNITY_AUTO_APPROVE_DAILY_CAP = "3";
    assert.equal(dailyCap(), 3);
    process.env.OPPORTUNITY_AUTO_APPROVE_DAILY_CAP = "-4";
    assert.equal(dailyCap(), 10);
    process.env.OPPORTUNITY_AUTO_APPROVE_DAILY_CAP = "lots";
    assert.equal(dailyCap(), 10);
  });
});

describe("when it is off", () => {
  it("records what it WOULD have done and changes nothing", async () => {
    await seedEntry();
    const submission = await seedSubmission(
      { ...READING, cycle: { label: CYCLE, closesOn: `${YEAR + 1}-03-15` } },
      { opportunitySlug: "khelo-football" }
    );
    const outcome = await considerAutoApproval(submission);
    assert.equal(outcome.action, "off");
    assert.equal(outcome.pass, true);

    const after = await DataSourceSubmission.findById(submission._id).lean();
    assert.equal(after.status, "PENDING_REVIEW", "still waits for a person");
    assert.equal(after.autoApproval.action, "off");
    const entry = await entryNow();
    assert.equal(entry.lastVerifiedOn, `${YEAR}-01-01`, "the entry is untouched");
    assert.equal(entry.cycle.closesOn, `${YEAR + 1}-03-01`);
    assert.equal(await AdminAuditLog.countDocuments({}), 0);
  });
});

describe("when it is on", () => {
  it("holds anything that breaks a rule, and says which, leaving the entry alone", async () => {
    on();
    await seedEntry();
    const submission = await seedSubmission(
      { ...READING, title: "A Different Scheme" },
      { opportunitySlug: "khelo-football" }
    );
    const outcome = await considerAutoApproval(submission);
    assert.equal(outcome.action, "held");
    assert.ok(outcome.failed.includes("identity-stable"));
    assert.equal(
      (await DataSourceSubmission.findById(submission._id).lean()).status,
      "PENDING_REVIEW"
    );
    assert.equal((await entryNow()).title, "Khelo Football Trials");
  });

  it("holds a reading whose quote was only partly found", async () => {
    on();
    await seedEntry();
    const data = { ...READING, summary: "A rewritten summary." };
    const submission = await seedSubmission(data, {
      opportunitySlug: "khelo-football",
      ...evidenceFor(data, "partial"),
    });
    const outcome = await considerAutoApproval(submission);
    assert.equal(outcome.action, "held");
    assert.ok(outcome.failed.includes("quotes-verified"));
    assert.equal((await entryNow()).summary, ENTRY.summary);
  });

  it("re-verifies a live entry the source confirms: only the date moves", async () => {
    on();
    await seedEntry();
    const submission = await seedSubmission(READING, { opportunitySlug: "khelo-football" });
    const outcome = await considerAutoApproval(submission);
    assert.equal(outcome.action, "reverified");

    const entry = await entryNow();
    assert.equal(entry.lastVerifiedOn, TODAY);
    assert.equal(entry.title, ENTRY.title);
    assert.equal(entry.status, "published");
    assert.equal(entry.cycle.closesOn, `${YEAR + 1}-03-01`);
    const after = await DataSourceSubmission.findById(submission._id).lean();
    assert.equal(after.status, "APPROVED");
    assert.equal(after.autoApproval.action, "reverified");
    assert.equal(after.reviewedBy, undefined, "no person reviewed it");
  });

  it("applies a small, evidenced change to a live entry and keeps the entry as it was to revert to", async () => {
    on();
    await seedEntry();
    const submission = await seedSubmission(
      { ...READING, cycle: { label: CYCLE, closesOn: `${YEAR + 1}-03-15` } },
      { opportunitySlug: "khelo-football" }
    );
    const outcome = await considerAutoApproval(submission);
    assert.equal(outcome.action, "approved");

    const entry = await entryNow();
    assert.equal(entry.cycle.closesOn, `${YEAR + 1}-03-15`);
    assert.equal(entry.lastVerifiedOn, TODAY);
    assert.equal(entry.status, "published");

    const after = await DataSourceSubmission.findById(submission._id).lean();
    assert.equal(after.autoApproval.before.cycle.closesOn, `${YEAR + 1}-03-01`);
    assert.equal(after.autoApproval.before.lastVerifiedOn, `${YEAR}-01-01`);
  });

  it("publishes a new entry that passes everything, through the same gate a person uses", async () => {
    on();
    const submission = await seedSubmission(READING);
    const outcome = await considerAutoApproval(submission);
    assert.equal(outcome.action, "published");
    const entry = await Opportunity.findById(outcome.entryId).lean();
    assert.equal(entry.status, "published");
    assert.equal(entry.lastVerifiedOn, TODAY);
    assert.ok(entry.publishedAt);
    assert.equal(outcome.before, null);
  });

  it("verifies and publishes a draft made from a lead, once it passes", async () => {
    on();
    const submission = await seedSubmission(READING, { autoDraft: true });
    const made = await createDraftFromSubmission(submission);
    assert.equal(made.ok, true);
    assert.equal((await Opportunity.findOne({ slug: made.slug }).lean()).lastVerifiedOn, undefined);

    const fresh = await DataSourceSubmission.findById(submission._id);
    const outcome = await considerAutoApproval(fresh);
    assert.equal(outcome.action, "published", outcome.reason);
    const entry = await Opportunity.findOne({ slug: made.slug }).lean();
    assert.equal(entry.status, "published");
    assert.equal(entry.lastVerifiedOn, TODAY);
  });

  it("leaves a draft unpublished and unverified when the draft cannot pass the publish gate", async () => {
    on();
    const submission = await seedSubmission(READING, { autoDraft: true });
    const made = await createDraftFromSubmission(submission);
    // Make the draft something the gate refuses, after the reading was judged.
    await Opportunity.updateOne({ slug: made.slug }, { $unset: { steps: 1, selection: 1 } });
    const outcome = await considerAutoApproval(await DataSourceSubmission.findById(submission._id));
    assert.notEqual(outcome.action, "published");
    const entry = await Opportunity.findOne({ slug: made.slug }).lean();
    assert.equal(entry.status, "draft");
    assert.equal(entry.lastVerifiedOn, undefined);
  });

  it("stops at the daily cap, leaving the rest for a person", async () => {
    on();
    process.env.OPPORTUNITY_AUTO_APPROVE_DAILY_CAP = "2";
    const outcomes: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const slug = `entry-${i}`;
      await seedEntry({ slug, title: `Scheme ${i}` });
      const data = { ...READING, title: `Scheme ${i}` };
      const submission = await seedSubmission(data, { opportunitySlug: slug });
      outcomes.push((await considerAutoApproval(submission)).action);
    }
    assert.deepEqual(outcomes, ["reverified", "reverified", "capped"]);
  });

  it("does nothing when the kill switch is on", async () => {
    on();
    process.env.OPPORTUNITY_AUTO_APPROVE_DISABLED = "true";
    await seedEntry();
    const outcome = await considerAutoApproval(
      await seedSubmission(READING, { opportunitySlug: "khelo-football" })
    );
    assert.equal(outcome.action, "off");
    assert.equal((await entryNow()).lastVerifiedOn, `${YEAR}-01-01`);
  });

  it("audits what it does under its own name, not a person's", async () => {
    on();
    await seedEntry();
    await considerAutoApproval(
      await seedSubmission(READING, { opportunitySlug: "khelo-football" })
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    const logs = await AdminAuditLog.find({}).lean();
    assert.ok(logs.length >= 1);
    assert.ok(
      logs.every(
        (log: { adminEmail: string }) => log.adminEmail === "auto-approver@powermysport.com"
      )
    );
    assert.ok(logs.some((log: { action: string }) => /auto-approve/.test(log.action)));
  });

  it("never throws, whatever goes wrong underneath", async () => {
    on();
    // A reading with no source link cannot be approved; it must be held, not crash.
    const submission = await seedSubmission(READING, {
      sourceUrl: undefined,
      originUrl: undefined,
    });
    await assert.doesNotReject(() => considerAutoApproval(submission));
  });
});

describe("reverting", () => {
  it("puts an updated entry back exactly as it was and hands the reading to a person", async () => {
    on();
    const original = await seedEntry();
    const submission = await seedSubmission(
      { ...READING, cycle: { label: CYCLE, closesOn: `${YEAR + 1}-03-15` } },
      { opportunitySlug: "khelo-football" }
    );
    await considerAutoApproval(submission);
    const acted = await DataSourceSubmission.findById(submission._id);

    const result = await revertAutoApproval(acted, EDITOR);
    assert.equal(result.ok, true);

    const entry = await entryNow();
    assert.equal(entry.cycle.closesOn, `${YEAR + 1}-03-01`);
    assert.equal(entry.lastVerifiedOn, `${YEAR}-01-01`);
    assert.equal(entry.status, "published");
    assert.equal(String(entry._id), String(original._id));

    const after = await DataSourceSubmission.findById(submission._id).lean();
    assert.equal(after.status, "PENDING_REVIEW");
    assert.ok(after.autoApproval.revertedAt);
    assert.equal(after.autoApproval.revertedBy, ADMIN_ID);
  });

  it("unpublishes a new entry and removes its verification, but never deletes it", async () => {
    on();
    const submission = await seedSubmission(READING);
    const outcome = await considerAutoApproval(submission);
    const result = await revertAutoApproval(
      await DataSourceSubmission.findById(submission._id),
      EDITOR
    );
    assert.equal(result.ok, true);

    const entry = await Opportunity.findById(outcome.entryId).lean();
    assert.ok(entry, "kept, not deleted");
    assert.equal(entry.status, "draft");
    assert.equal(entry.lastVerifiedOn, undefined);
    assert.equal(entry.publishedAt ?? null, null);
  });

  it("will not act again on a reading someone reverted, even if it is read again", async () => {
    on();
    await seedEntry();
    const submission = await seedSubmission(READING, { opportunitySlug: "khelo-football" });
    await considerAutoApproval(submission);
    await revertAutoApproval(await DataSourceSubmission.findById(submission._id), EDITOR);

    const again = await DataSourceSubmission.findById(submission._id);
    const outcome = await considerAutoApproval(again);
    assert.ok(outcome.revertedAt, "locked");
    assert.equal((await entryNow()).lastVerifiedOn, `${YEAR}-01-01`);
  });

  it("refuses to revert what the AI approver never did, or what was already reverted", async () => {
    const plain = await seedSubmission(READING);
    assert.equal((await revertAutoApproval(plain, EDITOR)).ok, false);

    on();
    await seedEntry();
    const done = await seedSubmission(READING, { opportunitySlug: "khelo-football" });
    await considerAutoApproval(done);
    await revertAutoApproval(await DataSourceSubmission.findById(done._id), EDITOR);
    const second = await revertAutoApproval(await DataSourceSubmission.findById(done._id), EDITOR);
    assert.equal(second.ok, false);
  });
});

describe("in the reading pipeline", () => {
  const reader = (data: Record<string, unknown>) => async () => ({
    status: "PENDING_REVIEW",
    extractedData: data,
    ...evidenceFor(data),
    extractionModel: "test",
  });

  it("settles a reading as soon as it is read, when on", async () => {
    on();
    await seedEntry();
    const submission = await seedSubmission(
      {},
      {
        status: "PENDING_EXTRACTION",
        opportunitySlug: "khelo-football",
        extractedData: undefined,
        citations: undefined,
        citationChecks: undefined,
      }
    );
    await runOpportunityExtraction(submission, { extract: reader(READING), notify: false });
    const after = await DataSourceSubmission.findById(submission._id).lean();
    assert.equal(after.status, "APPROVED");
    assert.equal(after.autoApproval.action, "reverified");
    assert.equal((await entryNow()).lastVerifiedOn, TODAY);
  });

  it("only records the verdict, and leaves the reading for review, when off", async () => {
    await seedEntry();
    const submission = await seedSubmission(
      {},
      {
        status: "PENDING_EXTRACTION",
        opportunitySlug: "khelo-football",
        extractedData: undefined,
        citations: undefined,
        citationChecks: undefined,
      }
    );
    await runOpportunityExtraction(submission, { extract: reader(READING), notify: false });
    const after = await DataSourceSubmission.findById(submission._id).lean();
    assert.equal(after.status, "PENDING_REVIEW");
    assert.equal(after.autoApproval.action, "off");
    assert.equal(after.autoApproval.pass, true);
  });

  it("keeps a reading the approver settled, instead of deleting it as the weekly check does for empty reads", async () => {
    on();
    await seedEntry();
    const summary = await createAutoDiffs(
      [
        {
          url: "https://indiakhelofootball.com/trials",
          changeKind: "text",
          entries: [{ slug: "khelo-football" }],
        },
      ],
      {
        read: (submission: InstanceType<typeof DataSourceSubmission>) =>
          runOpportunityExtraction(submission, { extract: reader(READING), notify: false }),
      }
    );
    assert.equal(summary.created, 1);
    assert.equal(summary.unreadable, 0);
    const kept = await DataSourceSubmission.find({ opportunitySlug: "khelo-football" }).lean();
    assert.equal(kept.length, 1, "the record of what the approver did survives");
    assert.equal(kept[0].autoApproval.action, "reverified");
  });
});
