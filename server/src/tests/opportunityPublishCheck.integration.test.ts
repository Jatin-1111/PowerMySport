// Tests for the pre-publish check (opportunityPublishCheck.ts): each plausibility
// rule on its own, the link check against a fake network, and the two places it
// is used, the publish endpoint and the on-demand check endpoint.
//
// Pinned: only a record that cannot be right (a verification date in the future)
// blocks publishing, everything else is passed back as advice; a site that turns
// our server away is "unchecked" and never "broken", while a page that is gone is
// a problem; and nothing the check says changes the entry.
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
const {
  SOURCE_OLDER_THAN_DAYS,
  checkOpportunityLinks,
  checkOpportunityOffline,
  sortFindings,
} = require("../admin/services/opportunityPublishCheck");
const { generateToken } = require("../utils/jwt");
const { todayInIndia, STALE_AFTER_DAYS } = require("../shared/validation/opportunityFormat");
const redis = require("../config/redis").default;

const TODAY = "2026-10-14";
const offset = (days: number, from = TODAY) =>
  new Date(Date.parse(`${from}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

type Finding = { severity: string; area: string; message: string };
const find = (findings: Finding[], area: string, severity?: string) =>
  findings.filter((f) => f.area === area && (!severity || f.severity === severity));

/** A clean, plausible entry: it should produce no problem and no warning. */
const clean = (over: Record<string, unknown> = {}) => ({
  title: "Delhi University sports quota",
  summary: "Extra seats for athletes.",
  selection: "trials",
  lastVerifiedOn: offset(-10),
  steps: ["Register on the admissions portal."],
  benefit: { summary: "A supernumerary seat." },
  cycle: { label: "2026-27", opensOn: offset(5), closesOn: offset(40) },
  sources: [
    { label: "DU admissions", url: "https://admission.uod.ac.in/", publishedOn: offset(-30) },
  ],
  ...over,
});

describe("checkOpportunityOffline", () => {
  it("says nothing about a plausible entry", () => {
    const findings = checkOpportunityOffline(clean(), TODAY);
    assert.deepEqual(
      findings.filter((f: Finding) => f.severity !== "note"),
      []
    );
  });

  it("treats a verification date in the future as a problem, and only that", () => {
    const future = checkOpportunityOffline(clean({ lastVerifiedOn: offset(1) }), TODAY);
    assert.equal(find(future, "verified", "problem").length, 1);
    const today = checkOpportunityOffline(clean({ lastVerifiedOn: TODAY }), TODAY);
    assert.equal(find(today, "verified", "problem").length, 0);
    for (const f of checkOpportunityOffline(clean({ closesOn: offset(-5) }), TODAY)) {
      assert.notEqual(f.severity, "problem");
    }
  });

  it("warns when the verification is over a year old, at the same bar as the admin tag", () => {
    const old = checkOpportunityOffline(
      clean({ lastVerifiedOn: offset(-(STALE_AFTER_DAYS + 1)) }),
      TODAY
    );
    const overAYear = (findings: Finding[]) =>
      find(findings, "verified", "warning").filter((f) => /over a year ago/.test(f.message));
    assert.equal(overAYear(old).length, 1);
    const edge = checkOpportunityOffline(
      clean({ lastVerifiedOn: offset(-STALE_AFTER_DAYS) }),
      TODAY
    );
    assert.equal(overAYear(edge).length, 0, "exactly a year is not yet over a year");
  });

  it("warns when it was verified before the newest source was published", () => {
    const findings = checkOpportunityOffline(
      clean({
        lastVerifiedOn: offset(-10),
        sources: [{ label: "Circular", url: "https://a.test/c", publishedOn: offset(-2) }],
      }),
      TODAY
    );
    assert.equal(find(findings, "verified", "warning").length, 1);
  });

  it("warns that a window has already closed", () => {
    const closed = checkOpportunityOffline(
      clean({ cycle: { label: "2026-27", closesOn: offset(-1) } }),
      TODAY
    );
    assert.equal(find(closed, "window", "warning").length, 1);
    const today = checkOpportunityOffline(
      clean({ cycle: { label: "2026-27", closesOn: TODAY } }),
      TODAY
    );
    assert.equal(find(today, "window", "warning").length, 0, "closing today is still open");
  });

  it("warns when the cycle label and its dates disagree", () => {
    const wrong = checkOpportunityOffline(
      clean({ cycle: { label: "2024-25", opensOn: "2026-11-01", closesOn: "2026-12-01" } }),
      TODAY
    );
    assert.equal(find(wrong, "window", "warning").length, 2);
    const right = checkOpportunityOffline(
      clean({ cycle: { label: "2026-27", opensOn: "2026-11-01", closesOn: "2027-02-01" } }),
      TODAY
    );
    assert.equal(find(right, "window", "warning").length, 0, "a cycle may run into the next year");
  });

  it("warns when the newest source long predates the window", () => {
    const reference = offset(40);
    const tooOld = checkOpportunityOffline(
      clean({
        sources: [
          {
            label: "Old",
            url: "https://a.test/old",
            publishedOn: offset(-SOURCE_OLDER_THAN_DAYS - 1, reference),
          },
        ],
        lastVerifiedOn: offset(-10),
      }),
      TODAY
    );
    assert.equal(find(tooOld, "sources", "warning").length, 1);
    const fine = checkOpportunityOffline(
      clean({
        sources: [
          {
            label: "Recent",
            url: "https://a.test/new",
            publishedOn: offset(-SOURCE_OLDER_THAN_DAYS, reference),
          },
        ],
      }),
      TODAY
    );
    assert.equal(find(fine, "sources", "warning").length, 0);
  });

  it("notes when no source says when it was published", () => {
    const findings = checkOpportunityOffline(
      clean({ sources: [{ label: "DU", url: "https://admission.uod.ac.in/" }] }),
      TODAY
    );
    assert.equal(find(findings, "sources", "note").length, 1);
  });

  it("flags a duplicated source, a listing site cited as a source, and plain http", () => {
    const findings = checkOpportunityOffline(
      clean({
        sources: [
          { label: "A", url: "https://a.test/rules", publishedOn: offset(-30) },
          { label: "A again", url: "https://www.a.test/rules/", publishedOn: offset(-30) },
          { label: "Listing", url: "https://www.buddy4study.com/page/x", publishedOn: offset(-30) },
          { label: "Plain", url: "http://b.test/rules", publishedOn: offset(-30) },
        ],
      }),
      TODAY
    );
    const messages = find(findings, "sources").map((f) => f.message);
    assert.ok(messages.some((m) => /listed twice/.test(m)));
    assert.ok(messages.some((m) => /listing site/.test(m)));
    assert.ok(messages.some((m) => /uses http/.test(m)));
  });

  it("warns when how-to-get-it contradicts the apply link", () => {
    const scouted = checkOpportunityOffline(
      clean({ selection: "scouted", applyUrl: "https://a.test/form" }),
      TODAY
    );
    assert.equal(find(scouted, "apply", "warning").length, 1);
    const noLink = checkOpportunityOffline(clean({ selection: "apply" }), TODAY);
    assert.equal(find(noLink, "apply", "warning").length, 1);
    const fine = checkOpportunityOffline(
      clean({ selection: "apply", applyUrl: "https://a.test/form" }),
      TODAY
    );
    assert.equal(find(fine, "apply").length, 0);
  });

  it("catches placeholder text anywhere a parent would read it", () => {
    const findings = checkOpportunityOffline(
      clean({
        summary: "TODO write this",
        steps: ["Fine", "Visit the site, XXXX"],
        benefit: { summary: "Lorem ipsum dolor" },
      }),
      TODAY
    );
    const messages = find(findings, "text", "warning").map((f) => f.message);
    assert.equal(messages.length, 3);
    assert.ok(messages.some((m) => /the summary/.test(m)));
    assert.ok(messages.some((m) => /step 2/.test(m)));
    assert.ok(messages.some((m) => /the benefit/.test(m)));
  });

  it("does not mistake ordinary words for placeholders", () => {
    const findings = checkOpportunityOffline(
      clean({
        summary: "Fixtures and fixed dates; a to-be-announced venue; a placeholder-free page.",
      }),
      TODAY
    );
    assert.equal(
      find(findings, "text", "warning").length,
      1,
      "only the literal word 'placeholder'"
    );
  });

  it("warns about another entry with the same title, however it is spelled", () => {
    const findings = checkOpportunityOffline(clean(), TODAY, [
      { slug: "du-quota-2", title: "DELHI university  sports QUOTA!" },
      { slug: "other", title: "Something else" },
    ]);
    assert.equal(find(findings, "duplicates", "warning").length, 1);
  });

  it("notes an entry with no steps", () => {
    const findings = checkOpportunityOffline(clean({ steps: [] }), TODAY);
    assert.equal(find(findings, "text", "note").length, 1);
  });

  it("sorts problems first, then warnings, then notes", () => {
    const sorted = sortFindings([
      { severity: "note", area: "a", message: "n" },
      { severity: "problem", area: "b", message: "p" },
      { severity: "warning", area: "c", message: "w" },
    ]);
    assert.deepEqual(
      sorted.map((f: Finding) => f.severity),
      ["problem", "warning", "note"]
    );
  });

  it("ignores malformed dates instead of failing", () => {
    const findings = checkOpportunityOffline(
      clean({
        lastVerifiedOn: "last week",
        cycle: { label: "2026-27", opensOn: "soon", closesOn: "2026-99-99" },
        sources: [{ label: "x", url: "https://a.test", publishedOn: "n/a" }],
      }),
      TODAY
    );
    assert.equal(find(findings, "verified").length, 0);
    assert.equal(find(findings, "window").length, 0);
  });
});

describe("checkOpportunityLinks", () => {
  const net =
    (pages: Record<string, { status: number; type?: string; body?: string }>) =>
    async (url: string) => {
      if (url.endsWith("/robots.txt")) {
        return new Response("User-agent: *\nDisallow: /private/\n", {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      }
      const page = pages[url];
      if (!page) return new Response("", { status: 404, headers: { "content-type": "text/html" } });
      const res = new Response(page.body ?? `<main>${"words ".repeat(400)}</main>`, {
        status: page.status,
        headers: { "content-type": page.type ?? "text/html" },
      });
      Object.defineProperty(res, "url", { value: url });
      return res;
    };
  const run = (entry: Record<string, unknown>, pages: Parameters<typeof net>[0]) =>
    checkOpportunityLinks(entry, { fetchImpl: net(pages), resolveUrl: async (raw: string) => raw });

  it("passes a page that opens and says nothing about it", async () => {
    const { findings, links } = await run(
      { sources: [{ label: "Rules", url: "https://ok.test/rules" }] },
      { "https://ok.test/rules": { status: 200 } }
    );
    assert.deepEqual(findings, []);
    assert.deepEqual(
      links.map((l: { status: string }) => l.status),
      ["ok"]
    );
  });

  it("calls a page that is gone a problem, and a dead apply link worse in its wording", async () => {
    const { findings } = await run(
      {
        applyUrl: "https://gone.test/apply",
        sources: [{ label: "Old circular", url: "https://gone.test/circular" }],
      },
      {}
    );
    assert.equal(findings.length, 2);
    for (const f of findings) assert.equal(f.severity, "problem");
    assert.ok(findings.some((f: Finding) => /Parents would be sent nowhere/.test(f.message)));
    assert.ok(findings.some((f: Finding) => /Find where it moved/.test(f.message)));
  });

  it("never calls a site that turns our server away broken", async () => {
    const { findings, links } = await run(
      {
        sources: [
          { label: "Blocked", url: "https://blocked.test/a" },
          { label: "Private", url: "https://ok.test/private/x" },
        ],
      },
      {
        "https://blocked.test/a": { status: 403, body: "Forbidden" },
        "https://ok.test/private/x": { status: 200 },
      }
    );
    assert.deepEqual(
      findings.map((f: Finding) => f.severity),
      ["note", "note"]
    );
    assert.deepEqual(
      links.map((l: { status: string }) => l.status),
      ["unchecked", "unchecked"]
    );
  });

  it("flags a file link that now leads to a page", async () => {
    const { findings } = await run(
      { sources: [{ label: "Circular", url: "https://ok.test/circular.pdf" }] },
      { "https://ok.test/circular.pdf": { status: 200, type: "text/html" } }
    );
    assert.equal(findings[0]?.severity, "warning");
  });

  it("checks each address once, even if listed twice", async () => {
    const seen: string[] = [];
    const base = net({ "https://ok.test/rules": { status: 200 } });
    await checkOpportunityLinks(
      {
        applyUrl: "https://ok.test/rules",
        sources: [
          { label: "A", url: "https://ok.test/rules" },
          { label: "B", url: "https://www.ok.test/rules/" },
        ],
      },
      {
        fetchImpl: async (url: string) => {
          if (!url.endsWith("/robots.txt")) seen.push(url);
          return base(url);
        },
        resolveUrl: async (raw: string) => raw,
      }
    );
    assert.equal(seen.length, 1);
  });
});

describe("the publish and check endpoints", () => {
  let mongod: { getUri(): string; stop(): Promise<void> };
  let manager: string;

  const signedIn = async (permissions: string[]) => {
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
    manager = await signedIn(["opportunities:manage"]);
  });

  const entry = (over: Record<string, unknown> = {}) => ({
    slug: "du-sports-quota",
    track: "admission",
    category: "college",
    title: "Delhi University sports quota",
    summary: "Extra seats for athletes, decided by a trial.",
    owner: { name: "University of Delhi", type: "university" },
    allSports: true,
    sports: [],
    geography: { scope: "india" },
    selection: "trials",
    benefit: { summary: "A supernumerary seat." },
    // A host that cannot resolve, so the link check never touches a real network.
    sources: [{ label: "DU admissions", url: "https://no-such-host.invalid/rules" }],
    ...over,
  });

  const create = async (over: Record<string, unknown> = {}) => {
    const res = await request(app)
      .post("/api/admin/opportunities")
      .set("Authorization", `Bearer ${manager}`)
      .send(entry(over));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.data._id as string;
  };
  const verify = (id: string) =>
    request(app)
      .post(`/api/admin/opportunities/${id}/verify`)
      .set("Authorization", `Bearer ${manager}`);
  const publish = (id: string) =>
    request(app)
      .post(`/api/admin/opportunities/${id}/status`)
      .set("Authorization", `Bearer ${manager}`)
      .send({ status: "published" });

  it("blocks a publish whose verification date is in the future, with the reason", async () => {
    const id = await create();
    await verify(id);
    await Opportunity.updateOne(
      { _id: id },
      { $set: { lastVerifiedOn: offset(3, todayInIndia()) } }
    );

    const res = await publish(id);

    assert.equal(res.status, 400);
    assert.match(res.body.errors.join(" "), /in the future/);
    assert.equal((await Opportunity.findById(id).lean()).status, "draft");
  });

  it("publishes with advice when the entry is merely questionable, and returns it", async () => {
    const id = await create({
      selection: "scouted",
      applyUrl: "https://no-such-host.invalid/apply",
      cycle: { label: "2026-27", closesOn: offset(-3, todayInIndia()), keyDates: [] },
    });
    await verify(id);

    const res = await publish(id);

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.status, "published");
    const areas = res.body.data.findings.map((f: Finding) => f.area);
    assert.ok(areas.includes("apply"));
    assert.ok(areas.includes("window"));
    assert.ok(
      res.body.data.findings.every((f: Finding) => f.severity !== "problem"),
      "advice does not block"
    );
  });

  it("publishes a plausible entry with no findings beyond notes", async () => {
    const id = await create();
    await verify(id);
    const res = await publish(id);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(res.body.data.findings.every((f: Finding) => f.severity === "note"));
  });

  it("checks an entry on request, without changing it", async () => {
    const id = await create();
    await verify(id);
    const before = await Opportunity.findById(id).lean();

    const res = await request(app)
      .post(`/api/admin/opportunities/${id}/check`)
      .set("Authorization", `Bearer ${manager}`);

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(Array.isArray(res.body.data.findings));
    assert.equal(res.body.data.links.length, 1);
    assert.equal(
      res.body.data.links[0].status,
      "unchecked",
      "an unresolvable host is not 'broken'"
    );
    const after = await Opportunity.findById(id).lean();
    assert.deepEqual(after, before, "a check never edits the entry");
  });

  it("needs the manage permission, and a real entry", async () => {
    const id = await create();
    const viewer = await signedIn(["opportunities:view"]);
    const forbidden = await request(app)
      .post(`/api/admin/opportunities/${id}/check`)
      .set("Authorization", `Bearer ${viewer}`);
    assert.equal(forbidden.status, 403);

    const missing = await request(app)
      .post(`/api/admin/opportunities/${new mongoose.Types.ObjectId()}/check`)
      .set("Authorization", `Bearer ${manager}`);
    assert.equal(missing.status, 404);
  });
});
