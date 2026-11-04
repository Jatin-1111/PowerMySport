// Integration tests for the weekly source watch against a fake network.
//
// Pinned: the first run records baselines and flags only what cannot be read;
// a later change is flagged until someone dismisses it; a URL no entry cites
// any more stops being checked; and the admin list reports all of it.
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
const { SourceWatch } = require("../shared/models/SourceWatch");
const { runOpportunityWatch } = require("../admin/services/opportunityWatch");
const { generateToken } = require("../utils/jwt");
const redis = require("../config/redis").default;

let mongod: { getUri(): string; stop(): Promise<void> };

/** What each fake URL answers with this run. */
let pages: Record<string, { status: number; type: string; body: string }> = {};

const fakeFetch = async (url: string) => {
  if (url.endsWith("/robots.txt")) {
    return new Response("User-agent: *\nDisallow: /private/\n", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }
  const page = pages[url];
  if (!page) return new Response("", { status: 404, headers: { "content-type": "text/html" } });
  const res = new Response(page.body, {
    status: page.status,
    headers: { "content-type": page.type },
  });
  Object.defineProperty(res, "url", { value: url });
  return res;
};

const run = () =>
  runOpportunityWatch({
    fetchImpl: fakeFetch,
    resolveUrl: async (raw: string) => raw,
    pauseMs: 0,
    notify: false,
  });

const htmlPage = (text: string, links: string[] = []) => ({
  status: 200,
  type: "text/html",
  body: `<html><body><main>${text} ${"filler ".repeat(300)}${links
    .map((l) => `<a href="${l}">doc</a>`)
    .join("")}</main></body></html>`,
});

const seedEntry = (slug: string, sources: string[], watchUrls: string[] = []) =>
  Opportunity.create({
    slug,
    track: "scholarship",
    category: "government",
    title: slug,
    sources: sources.map((url) => ({ label: "Source", url })),
    watchUrls,
    status: "draft",
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
  await Promise.all([Opportunity.deleteMany({}), SourceWatch.deleteMany({}), Admin.deleteMany({})]);
  pages = {
    "https://site.test/scheme": htmlPage("Scheme rules for 2026", ["/files/2026.pdf"]),
    "https://site.test/files/guidelines.pdf": {
      status: 200,
      type: "application/pdf",
      body: "%PDF v1",
    },
    "https://blocked.test/page": { status: 403, type: "text/html", body: "Forbidden" },
    "https://site.test/private/list": htmlPage("Private list"),
  };
});

describe("runOpportunityWatch", () => {
  it("records baselines on the first run and flags only what cannot be read", async () => {
    await seedEntry("khelo-india", [
      "https://site.test/scheme",
      "https://site.test/files/guidelines.pdf",
    ]);
    await seedEntry(
      "state-scheme",
      ["https://blocked.test/page"],
      ["https://site.test/private/list"]
    );

    const summary = await run();
    assert.equal(summary.firstRun, true);
    assert.equal(summary.checked, 4);
    assert.equal(summary.ok, 2);
    assert.equal(summary.changed, 0);

    const byUrl = Object.fromEntries(
      (await SourceWatch.find({}).lean()).map((w: { url: string; status: string }) => [
        w.url,
        w.status,
      ])
    );
    assert.deepEqual(byUrl, {
      "https://site.test/scheme": "ok",
      "https://site.test/files/guidelines.pdf": "ok",
      "https://blocked.test/page": "blocked",
      "https://site.test/private/list": "disallowed",
    });
  });

  it("flags a new document linked from a page, and a changed file", async () => {
    await seedEntry("khelo-india", [
      "https://site.test/scheme",
      "https://site.test/files/guidelines.pdf",
    ]);
    await run();

    pages["https://site.test/scheme"] = htmlPage("Scheme rules for 2026", [
      "/files/2026.pdf",
      "/files/2027.pdf",
    ]);
    pages["https://site.test/files/guidelines.pdf"] = {
      status: 200,
      type: "application/pdf",
      body: "%PDF v2",
    };
    const summary = await run();
    assert.equal(summary.changed, 2);

    const scheme = await SourceWatch.findOne({ url: "https://site.test/scheme" }).lean();
    assert.equal(scheme.changeKind, "documents");
    assert.ok(scheme.lastChangedAt);
  });

  it("keeps the last good fingerprint through a failed fetch", async () => {
    await seedEntry("khelo-india", ["https://site.test/scheme"]);
    await run();
    const before = await SourceWatch.findOne({ url: "https://site.test/scheme" }).lean();

    pages["https://site.test/scheme"] = { status: 503, type: "text/html", body: "down" };
    await run();
    const during = await SourceWatch.findOne({ url: "https://site.test/scheme" }).lean();
    assert.equal(during.status, "blocked");
    assert.equal(during.fingerprint, before.fingerprint);

    pages["https://site.test/scheme"] = htmlPage("Scheme rules for 2026", ["/files/2026.pdf"]);
    const summary = await run();
    assert.equal(summary.changed, 0);
  });

  it("stops checking a URL no entry cites any more", async () => {
    await seedEntry("khelo-india", ["https://site.test/scheme"]);
    await run();
    await Opportunity.updateOne({ slug: "khelo-india" }, { $set: { sources: [] } });
    await run();
    assert.equal(await SourceWatch.countDocuments({}), 0);
  });
});

describe("admin: the watch list", () => {
  const signIn = async () => {
    const id = new mongoose.Types.ObjectId();
    await Admin.collection.insertOne({
      _id: id,
      name: "Test admin",
      email: `${id.toString()}@example.test`,
      password: "not-a-real-hash",
      role: "OPERATIONS_ADMIN",
      permissions: ["opportunities:manage"],
      isActive: true,
    });
    return generateToken({
      id: id.toString(),
      email: `${id}@example.test`,
      role: "OPERATIONS_ADMIN",
    });
  };

  it("shows a change as needing attention until it is dismissed", async () => {
    await seedEntry("khelo-india", ["https://site.test/scheme"]);
    await run();
    pages["https://site.test/scheme"] = htmlPage("Scheme rules for 2027");
    await run();

    const token = await signIn();
    const list = await request(app)
      .get("/api/admin/opportunity-watch")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(list.status, 200);
    const [watch] = list.body.data.watches;
    assert.equal(watch.needsAttention, true);
    assert.equal(watch.entries[0].slug, "khelo-india");

    const dismissed = await request(app)
      .post(`/api/admin/opportunity-watch/${watch._id}/dismiss`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(dismissed.status, 200);

    const after = await request(app)
      .get("/api/admin/opportunity-watch")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(after.body.data.watches[0].needsAttention, false);
  });

  it("keeps an unreadable source quiet once dismissed, until its status changes", async () => {
    await seedEntry("state-scheme", ["https://blocked.test/page"]);
    await run();
    const token = await signIn();
    const [watch] = (
      await request(app).get("/api/admin/opportunity-watch").set("Authorization", `Bearer ${token}`)
    ).body.data.watches;
    assert.equal(watch.needsAttention, true);

    await request(app)
      .post(`/api/admin/opportunity-watch/${watch._id}/dismiss`)
      .set("Authorization", `Bearer ${token}`);
    await run();
    const [still] = (
      await request(app).get("/api/admin/opportunity-watch").set("Authorization", `Bearer ${token}`)
    ).body.data.watches;
    assert.equal(still.needsAttention, false);

    pages["https://blocked.test/page"] = { status: 404, type: "text/html", body: "" };
    await run();
    const [gone] = (
      await request(app).get("/api/admin/opportunity-watch").set("Authorization", `Bearer ${token}`)
    ).body.data.watches;
    assert.equal(gone.status, "gone");
    assert.equal(gone.needsAttention, true);
  });
});
