// HTTP-level tests for admissions & scholarships: the admin CMS that curates
// them and the public reads behind /admissions and /scholarships.
//
// What is pinned is the publishing bar. A figure on these pages is one a parent
// may act on, so nothing reaches them without sources and a verification date
// set by a person pressing "Mark verified", a live entry cannot be edited below
// that bar, and a window that has closed reads as closed without any job
// having to run.
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
const { generateToken } = require("../utils/jwt");
const { todayInIndia } = require("../shared/validation/opportunityFormat");
const redis = require("../config/redis").default;

let mongod: { getUri(): string; stop(): Promise<void> };

const signedInAdmin = async (permissions: string[]) => {
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
    email: `${id.toString()}@example.test`,
    role: "OPERATIONS_ADMIN",
  });
};

/** A date string `days` from today, in the same zone the server compares in. */
const dayOffset = (days: number): string => {
  const d = new Date(`${todayInIndia()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const complete = (overrides: Record<string, unknown> = {}) => ({
  slug: "du-sports-quota",
  track: "admission",
  category: "college",
  title: "Delhi University sports quota",
  summary: "Extra seats for athletes, decided by a trial, certificates and CUET.",
  owner: { name: "University of Delhi", type: "university" },
  allSports: true,
  sports: [],
  geography: { scope: "india" },
  selection: "trials",
  benefit: { summary: "A supernumerary seat, outside the general merit list." },
  sources: [{ label: "DU admissions", url: "https://admission.uod.ac.in/" }],
  ...overrides,
});

let manager: string;

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
  await Opportunity.deleteMany({});
  await Admin.deleteMany({});
  manager = await signedInAdmin(["opportunities:manage"]);
});

// supertest is required untyped here, like every other integration test, so
// the response shape is declared once rather than cast at each assertion.
type ApiResponse = { status: number; body: any };
const asManager = (req: { set: (k: string, v: string) => unknown }): Promise<ApiResponse> =>
  req.set("Authorization", `Bearer ${manager}`) as Promise<ApiResponse>;

const createDraft = async (body: Record<string, unknown>) => {
  const res = await asManager(request(app).post("/api/admin/opportunities").send(body));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data._id as string;
};

const publish = (id: string) =>
  asManager(
    request(app).post(`/api/admin/opportunities/${id}/status`).send({ status: "published" })
  );

const verify = (id: string) =>
  asManager(request(app).post(`/api/admin/opportunities/${id}/verify`));

describe("admin: drafting and publishing", () => {
  it("saves a draft with only the identifying fields", async () => {
    await createDraft({
      slug: "khelo-india-athlete",
      track: "scholarship",
      category: "government",
      title: "Khelo India athlete scholarship",
    });
    assert.equal(await Opportunity.countDocuments({ status: "draft" }), 1);
  });

  it("rejects a category that belongs to the other track", async () => {
    const res = await asManager(
      request(app)
        .post("/api/admin/opportunities")
        .send({ slug: "x", track: "admission", category: "government", title: "Mixed up" })
    );
    assert.equal(res.status, 400);
    assert.match(res.body.errors.join(" "), /category/);
  });

  it("will not publish until someone has marked it verified", async () => {
    const id = await createDraft(complete());

    const blocked = await publish(id);
    assert.equal(blocked.status, 400);
    assert.match(blocked.body.errors.join(" "), /lastVerifiedOn/);

    assert.equal((await verify(id)).status, 200);
    assert.equal((await publish(id)).status, 200);
  });

  it("ignores a verification date sent with a save", async () => {
    const id = await createDraft(complete());
    const res = await asManager(
      request(app)
        .put(`/api/admin/opportunities/${id}`)
        .send({ ...complete(), lastVerifiedOn: "2026-01-01" })
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.data.lastVerifiedOn, undefined);
  });

  it("refuses to mark verified an entry with no sources", async () => {
    const id = await createDraft({
      slug: "no-sources",
      track: "scholarship",
      category: "company",
      title: "Nothing checked",
    });
    assert.equal((await verify(id)).status, 400);
  });

  it("keeps a live entry complete on every save", async () => {
    const id = await createDraft(complete());
    await verify(id);
    await publish(id);

    const { sources: _dropped, ...withoutSources } = complete();
    const res = await asManager(
      request(app).put(`/api/admin/opportunities/${id}`).send(withoutSources)
    );
    assert.equal(res.status, 400);
    assert.equal((await Opportunity.findById(id).lean()).sources.length, 1);
  });

  it("clears a field the editor emptied instead of keeping the old value", async () => {
    const id = await createDraft(complete({ applyUrl: "https://example.test/apply" }));
    const res = await asManager(
      request(app).put(`/api/admin/opportunities/${id}`).send(complete())
    );
    assert.equal(res.status, 200);
    assert.equal((await Opportunity.findById(id).lean()).applyUrl, undefined);
  });

  it("is closed to an admin without the permission", async () => {
    const viewer = await signedInAdmin(["pathways:manage"]);
    const res = await request(app)
      .get("/api/admin/opportunities")
      .set("Authorization", `Bearer ${viewer}`);
    assert.equal(res.status, 403);
  });
});

describe("public reads", () => {
  const publishNew = async (overrides: Record<string, unknown>) => {
    const id = await createDraft(complete(overrides));
    await verify(id);
    await publish(id);
    return id;
  };

  it("lists only published entries of the requested track", async () => {
    await publishNew({});
    await createDraft(complete({ slug: "still-a-draft", title: "Draft entry" }));
    await publishNew({
      slug: "tops",
      track: "scholarship",
      category: "government",
      title: "TOPS",
      selection: "nominated",
    });

    const res = await request(app).get("/api/opportunities?track=admission");
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.data.items.map((i: { slug: string }) => i.slug),
      ["du-sports-quota"]
    );
  });

  it("filters by sport, keeping every all-sports scheme", async () => {
    await publishNew({ slug: "all-sports", title: "Any sport" });
    await publishNew({
      slug: "tennis-only",
      title: "Tennis",
      allSports: false,
      sports: ["tennis"],
    });
    await publishNew({ slug: "chess-only", title: "Chess", allSports: false, sports: ["chess"] });

    const res = await request(app).get("/api/opportunities?track=admission&sport=tennis");
    assert.deepEqual(res.body.data.items.map((i: { slug: string }) => i.slug).sort(), [
      "all-sports",
      "tennis-only",
    ]);
    assert.deepEqual(res.body.data.sports, ["chess", "tennis"]);
  });

  it("works out the window from today, with open windows first", async () => {
    await publishNew({
      slug: "closed",
      title: "A closed one",
      cycle: { opensOn: dayOffset(-60), closesOn: dayOffset(-1), keyDates: [] },
    });
    await publishNew({
      slug: "open",
      title: "Z open one",
      cycle: { opensOn: dayOffset(-5), closesOn: dayOffset(20), keyDates: [] },
    });

    const res = await request(app).get("/api/opportunities?track=admission");
    assert.deepEqual(
      res.body.data.items.map((i: { slug: string; cycleState: string }) => [i.slug, i.cycleState]),
      [
        ["open", "open"],
        ["closed", "closed"],
      ]
    );
  });

  it("does not serve a draft by its slug", async () => {
    await createDraft(complete());
    const res = await request(app).get("/api/opportunities/du-sports-quota");
    assert.equal(res.status, 404);
  });

  it("serves a published entry by its slug, flagged fresh", async () => {
    await publishNew({});
    const res = await request(app).get("/api/opportunities/du-sports-quota");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.stale, false);
    assert.equal(res.body.data.updatedBy, undefined);
  });
});

describe("starter drafts", () => {
  it("are each publishable once someone verifies them", () => {
    const { DRAFTS } = require("../scripts/seedOpportunityDrafts");
    const { parseOpportunity } = require("../shared/validation/opportunityFormat");
    for (const draft of DRAFTS) {
      const check = parseOpportunity({ ...draft, lastVerifiedOn: todayInIndia() });
      assert.ok(check.ok, `${draft.slug}: ${check.ok ? "" : check.errors.join("; ")}`);
    }
  });
});
