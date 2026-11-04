// HTTP-level tests for reviewing admissions & scholarships read from a source.
//
// Submissions are seeded already read ("waiting for review"), so nothing here
// calls the model. What is pinned is what approval does: writes only the kept
// changes, cites the source, counts as verification, and holds a live entry to
// the publishing bar. Also that the generic data-source routes refuse these
// submissions, since their approve path would treat one as a calendar.
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
const { DataSourceSubmission } = require("../shared/models/DataSourceSubmission");
const { generateToken } = require("../utils/jwt");
const { todayInIndia } = require("../shared/validation/opportunityFormat");
const redis = require("../config/redis").default;

let mongod: { getUri(): string; stop(): Promise<void> };
let token: string;
let adminId: string;

type ApiResponse = { status: number; body: any };
const as = (req: { set: (k: string, v: string) => unknown }): Promise<ApiResponse> =>
  req.set("Authorization", `Bearer ${token}`) as Promise<ApiResponse>;

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
  adminId = id.toString();
  return generateToken({
    id: id.toString(),
    email: `${id.toString()}@example.test`,
    role: "OPERATIONS_ADMIN",
  });
};

const liveEntry = () =>
  Opportunity.create({
    slug: "du-sports-quota",
    track: "admission",
    category: "college",
    title: "Delhi University sports quota",
    summary: "Extra seats for athletes.",
    owner: { name: "University of Delhi", type: "university" },
    allSports: true,
    sports: [],
    geography: { scope: "india" },
    eligibility: { gender: "any", level: "Certificates from the last three years" },
    selection: "trials",
    benefit: { summary: "A supernumerary seat." },
    cycle: { label: "2025-26", keyDates: [] },
    sources: [{ label: "Old bulletin", url: "https://old.example/bulletin.pdf" }],
    lastVerifiedOn: "2025-07-01",
    status: "published",
    publishedAt: new Date(),
  });

const seedSource = (overrides: Record<string, unknown> = {}) =>
  DataSourceSubmission.create({
    targetType: "OPPORTUNITY",
    sportSlug: "tennis",
    opportunitySlug: "du-sports-quota",
    opportunityTrack: "admission",
    sourceLabel: "DU admissions bulletin 2026-27",
    sourceKind: "LINK",
    sourceUrl: "https://admission.example/bulletin-2026.pdf",
    status: "PENDING_REVIEW",
    extractedData: {
      cycle: { label: "2026-27" },
      eligibility: { level: "Certificates from 1 May 2023 to 30 April 2026" },
      summary: "A made-up summary the reviewer will not keep.",
      sourcePublishedOn: "2026-06-15",
    },
    citations: { eligibility: "certificates issued between 01.05.2023 and 30.04.2026" },
    submittedBy: new mongoose.Types.ObjectId(),
    ...overrides,
  });

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
    DataSourceSubmission.deleteMany({}),
    Admin.deleteMany({}),
  ]);
  token = await signIn([
    "opportunities:manage",
    "data-sources:view",
    "data-sources:review",
    "data-sources:manage",
  ]);
});

describe("reviewing a source for an existing entry", () => {
  it("lists each proposed change with its quote", async () => {
    await liveEntry();
    const source = await seedSource();

    const res = await as(request(app).get(`/api/admin/opportunity-sources/${source._id}`));
    assert.equal(res.status, 200);
    const paths = res.body.data.changes.map((c: { path: string }) => c.path);
    assert.deepEqual(paths.sort(), ["cycle.label", "eligibility.level", "summary"]);
    const level = res.body.data.changes.find(
      (c: { path: string }) => c.path === "eligibility.level"
    );
    assert.equal(level.current, "Certificates from the last three years");
    assert.match(level.citation, /01\.05\.2023/);
  });

  it("writes only the kept changes, cites the source and counts as verified", async () => {
    await liveEntry();
    const source = await seedSource();

    const res = await as(
      request(app)
        .post(`/api/admin/opportunity-sources/${source._id}/approve`)
        .send({ keep: ["cycle.label", "eligibility.level"] })
    );
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const entry = await Opportunity.findOne({ slug: "du-sports-quota" }).lean();
    assert.equal(entry.cycle.label, "2026-27");
    assert.equal(entry.eligibility.level, "Certificates from 1 May 2023 to 30 April 2026");
    assert.equal(entry.eligibility.gender, "any");
    assert.equal(entry.summary, "Extra seats for athletes.");
    assert.equal(entry.lastVerifiedOn, todayInIndia());
    assert.equal(entry.status, "published");
    assert.deepEqual(entry.sources[0], {
      label: "DU admissions bulletin 2026-27",
      url: "https://admission.example/bulletin-2026.pdf",
      publishedOn: "2026-06-15",
    });
    assert.equal(entry.sources.length, 2);

    const approved = await DataSourceSubmission.findById(source._id).lean();
    assert.equal(approved.status, "APPROVED");
    assert.equal(String(approved.reviewedBy), adminId);
  });

  it("records a verification even when nothing changed", async () => {
    await liveEntry();
    const source = await seedSource();
    const res = await as(
      request(app).post(`/api/admin/opportunity-sources/${source._id}/approve`).send({ keep: [] })
    );
    assert.equal(res.status, 200);
    const entry = await Opportunity.findOne({ slug: "du-sports-quota" }).lean();
    assert.equal(entry.lastVerifiedOn, todayInIndia());
    assert.equal(entry.cycle.label, "2025-26");
  });

  it("will not approve twice", async () => {
    await liveEntry();
    const source = await seedSource();
    await as(
      request(app).post(`/api/admin/opportunity-sources/${source._id}/approve`).send({ keep: [] })
    );
    const again = await as(
      request(app).post(`/api/admin/opportunity-sources/${source._id}/approve`).send({ keep: [] })
    );
    assert.equal(again.status, 400);
  });
});

describe("reviewing a source for a new entry", () => {
  const newSource = (extractedData: Record<string, unknown>) =>
    seedSource({ opportunitySlug: undefined, opportunityTrack: "scholarship", extractedData });

  it("creates a verified draft from the kept fields", async () => {
    const source = await newSource({
      title: "IndianOil sports scholarship",
      category: "company",
      summary: "Monthly scholarships for ranked juniors.",
    });
    const res = await as(
      request(app)
        .post(`/api/admin/opportunity-sources/${source._id}/approve`)
        .send({ keep: ["title", "category", "summary"] })
    );
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const created = await Opportunity.findById(res.body.data.opportunityId).lean();
    assert.equal(created.slug, "indianoil-sports-scholarship");
    assert.equal(created.track, "scholarship");
    assert.equal(created.status, "draft");
    assert.equal(created.lastVerifiedOn, todayInIndia());
    assert.equal(created.sources.length, 1);
  });

  it("needs a title and a section", async () => {
    const source = await newSource({ summary: "No title was read." });
    const res = await as(
      request(app)
        .post(`/api/admin/opportunity-sources/${source._id}/approve`)
        .send({ keep: ["summary"] })
    );
    assert.equal(res.status, 400);
    assert.equal(await Opportunity.countDocuments({}), 0);
  });

  it("lets the reviewer set the missing fields first", async () => {
    const source = await newSource({ summary: "No title was read." });
    const patch = await as(
      request(app)
        .patch(`/api/admin/opportunity-sources/${source._id}`)
        .send({ fields: { title: "GoSports athlete programme", category: "company" } })
    );
    assert.equal(patch.status, 200);
    const res = await as(
      request(app)
        .post(`/api/admin/opportunity-sources/${source._id}/approve`)
        .send({ keep: ["title", "category", "summary"] })
    );
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });
});

describe("creating a source", () => {
  it("needs a name for the document, since parents see it as the source", async () => {
    const res = await as(
      request(app)
        .post("/api/admin/opportunity-sources")
        .send({ track: "scholarship", sourceKind: "LINK", sourceUrl: "https://example.test" })
    );
    assert.equal(res.status, 400);
  });

  it("needs the official page an uploaded PDF came from", async () => {
    const res = await as(
      request(app).post("/api/admin/opportunity-sources").send({
        track: "scholarship",
        sourceKind: "PDF",
        s3Key: "federation-sources/opportunities/1.pdf",
        sourceLabel: "Scheme PDF",
      })
    );
    assert.equal(res.status, 400);
    assert.match(res.body.message, /official page/);
  });
});

describe("the generic data-source routes", () => {
  it("refuse to approve an admission or scholarship source", async () => {
    await liveEntry();
    const source = await seedSource();
    const res = await as(request(app).post(`/api/admin/data-sources/${source._id}/approve`));
    assert.equal(res.status, 400);
    assert.equal((await DataSourceSubmission.findById(source._id).lean()).status, "PENDING_REVIEW");
  });

  it("leave them out of the general list", async () => {
    await seedSource();
    const res = await as(request(app).get("/api/admin/data-sources"));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 0);
  });

  it("are closed to an admin without the opportunities permission", async () => {
    token = await signIn(["data-sources:review"]);
    const source = await seedSource();
    const res = await as(request(app).get(`/api/admin/opportunity-sources/${source._id}`));
    assert.equal(res.status, 403);
  });
});
