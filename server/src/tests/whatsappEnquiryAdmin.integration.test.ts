/* eslint-disable @typescript-eslint/no-var-requires */
// HTTP-level tests for the admin enquiries screen: who may call each route, that no phone number or
// hash ever comes back from a list, a detail or the CSV, and that the number is revealed (and
// logged) only for an enquiry where the parent asked for a person.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.BANK_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);
process.env.REDIS_ENABLED = "false";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const Admin = require("../admin/models/Admin").default;
const redis = require("../config/redis").default;
const { WhatsAppEnquiry } = require("../client/models/WhatsAppEnquiry");
const { AdminAuditLog } = require("../admin/models/AdminAuditLog");
const enquiries = require("../shared/services/whatsappEnquiries");
const admin = require("../admin/services/WhatsAppEnquiryAdminService");
const {
  up,
  down,
  WHATSAPP_ENQUIRY_ADMIN_INDEXES,
} = require("../migrations/69_whatsapp_enquiry_admin_indexes");

const oid = () => new mongoose.Types.ObjectId();
const BASE = "/api/admin/whatsapp-pilot/enquiries";
const PHONE = "919812345678";
const HASH = "hash-parent-1";

let mongod: any;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await WhatsAppEnquiry.init();
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  for (const name of ["admins", "whatsappenquiries", "adminauditlogs"]) {
    await mongoose.connection.db.collection(name).deleteMany({});
  }
});

const signedInAdmin = async (permissions: string[]) => {
  const adminId = oid();
  const email = `${adminId.toString()}@example.test`;
  await Admin.collection.insertOne({
    _id: adminId,
    name: "Test admin",
    email,
    password: "not-a-real-hash",
    role: "OPERATIONS_ADMIN",
    permissions,
    isActive: true,
  });
  return generateToken({ id: adminId.toString(), email, role: "OPERATIONS_ADMIN" });
};

const call = (method: string, path: string, token?: string, body?: unknown) => {
  const req = (request(app) as any)[method](path);
  if (token) req.set("Authorization", `Bearer ${token}`);
  if (body !== undefined) req.send(body);
  return req;
};

/** An enquiry made the way production makes one, so the stored shape is the real one. */
const seed = async (
  hash: string,
  fields: Record<string, unknown>,
  question = "which sport suits my son?"
) => {
  const doc = await enquiries.updateEnquiry(hash, question, fields);
  await enquiries.recordTurn(hash, question, "Try the assessment.", new Date(Date.now() - 1000));
  return doc;
};

describe("who may call the enquiries routes", () => {
  const ID = oid().toString();
  const ROUTES: Array<[string, string, unknown?]> = [
    ["get", BASE],
    ["get", `${BASE}/summary`],
    ["get", `${BASE}/export.csv`],
    ["get", `${BASE}/${ID}`],
    ["patch", `${BASE}/${ID}`, { followUpStatus: "done" }],
    ["post", `${BASE}/${ID}/reveal-contact`, {}],
  ];

  it("refuses anonymous callers everywhere", async () => {
    for (const [method, path, body] of ROUTES) {
      assert.equal((await call(method, path, undefined, body)).status, 401, path);
    }
  });

  it("an admin without notifications permissions is refused everywhere", async () => {
    const token = await signedInAdmin(["analytics:view"]);
    for (const [method, path, body] of ROUTES) {
      assert.equal((await call(method, path, token, body)).status, 403, path);
    }
  });

  it("notifications:view can read but not change or reveal", async () => {
    const token = await signedInAdmin(["notifications:view"]);
    assert.equal((await call("get", BASE, token)).status, 200);
    assert.equal((await call("get", `${BASE}/summary`, token)).status, 200);
    assert.equal((await call("get", `${BASE}/export.csv`, token)).status, 200);
    assert.equal((await call("patch", `${BASE}/${ID}`, token, { teamNote: "x" })).status, 403);
    assert.equal((await call("post", `${BASE}/${ID}/reveal-contact`, token, {})).status, 403);
  });
});

describe("listing and reading", () => {
  it("never returns a number, a hash or the encrypted number, in a list or a detail", async () => {
    const doc = await seed(HASH, { sport: "Tennis" });
    await enquiries.markFollowUpRequested(HASH, "q", { summary: "call me" });
    await enquiries.attachContactNumber(HASH, PHONE);

    const token = await signedInAdmin(["notifications:view"]);
    const list = await call("get", BASE, token);
    const detail = await call("get", `${BASE}/${doc._id}`, token);
    const csv = await call("get", `${BASE}/export.csv`, token);

    for (const res of [list, detail]) {
      const text = JSON.stringify(res.body);
      assert.ok(!text.includes(PHONE));
      assert.ok(!text.includes(HASH));
      assert.ok(!text.includes("contactPhoneEnc"));
      assert.ok(!text.includes("phoneHash"));
    }
    assert.ok(!csv.text.includes(PHONE));
    assert.ok(!csv.text.includes(HASH));
    assert.equal(list.body.data.rows[0].hasContact, true);
    assert.equal(list.body.data.rows[0].parentRef, enquiries.parentRefFor(HASH));
  });

  it("filters by status, sport, help asked, feedback and words in the question", async () => {
    await seed("h1", { sport: "Tennis", feedback: "helpful" }, "tennis fees please");
    await seed("h2", { sport: "Chess", assistance: ["coach"] }, "chess coach near me");
    await enquiries.markFollowUpRequested("h2", "q", { summary: "s" });
    const token = await signedInAdmin(["notifications:view"]);

    const count = async (qs: string) => (await call("get", `${BASE}?${qs}`, token)).body.data.total;
    assert.equal(await count(""), 2);
    assert.equal(await count("status=new"), 1);
    assert.equal(await count("sport=tennis"), 1);
    assert.equal(await count("assistance=coach"), 1);
    assert.equal(await count("feedback=helpful"), 1);
    assert.equal(await count("q=chess"), 1);
    assert.equal(await count("status=bogus"), 2, "an unknown status is ignored, not an error");
  });

  it("treats regex characters and operator objects in the query as plain text", async () => {
    await seed("h1", { sport: "Tennis" });
    const token = await signedInAdmin(["notifications:view"]);
    const odd = await call("get", `${BASE}?q=.*`, token);
    assert.equal(odd.status, 200);
    assert.equal(odd.body.data.total, 0, "'.*' is searched for literally");

    const injected = await call("get", `${BASE}?sport[$ne]=x&status[$gt]=`, token);
    assert.equal(injected.status, 200);
    assert.equal(injected.body.data.total, 1);
  });

  it("pages the list and answers 404 for an unknown or malformed id", async () => {
    for (let i = 0; i < 3; i++) await seed(`h${i}`, { sport: "Tennis" });
    const token = await signedInAdmin(["notifications:view"]);
    const page = await call("get", `${BASE}?limit=2&page=2`, token);
    assert.equal(page.body.data.rows.length, 1);
    assert.equal(page.body.data.totalPages, 2);

    assert.equal((await call("get", `${BASE}/${oid()}`, token)).status, 404);
    assert.equal((await call("get", `${BASE}/not-an-id`, token)).status, 404);
  });

  it("summarises parents, follow-ups, help asked and feedback", async () => {
    await seed("h1", { sport: "Tennis", feedback: "helpful", assistance: ["tournaments"] });
    await seed("h2", { sport: "tennis", feedback: "not_helpful" });
    await enquiries.markFollowUpRequested("h2", "q", { summary: "s" });
    await seed("h2", { sport: "Chess", closed: true });
    await seed("h3", { sport: "TENNIS" });
    const token = await signedInAdmin(["notifications:view"]);

    const { data } = (await call("get", `${BASE}/summary`, token)).body;
    assert.equal(data.parents, 3);
    assert.equal(data.needsFollowUp, 1);
    assert.equal(data.asksForTeam, 1);
    assert.deepEqual(data.feedback, { helpful: 1, notHelpful: 1 });
    assert.equal(data.bySport[0].sport, "tennis");
  });
});

describe("changing an enquiry", () => {
  it("sets the follow-up status and a team note, and logs it without the note's text", async () => {
    const doc = await seed(HASH, { sport: "Tennis" });
    const token = await signedInAdmin(["notifications:manage"]);

    const res = await call("patch", `${BASE}/${doc._id}`, token, {
      followUpStatus: "contacted",
      teamNote: "Called, will send academies",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.followUpStatus, "contacted");
    assert.equal(res.body.data.teamNote, "Called, will send academies");

    const log = await AdminAuditLog.findOne({ action: "whatsapp-pilot.enquiries.update" }).lean();
    assert.ok(log);
    assert.ok(!JSON.stringify(log).includes("academies"));
  });

  it("refuses an unknown status and an empty change", async () => {
    const doc = await seed(HASH, { sport: "Tennis" });
    const token = await signedInAdmin(["notifications:manage"]);
    assert.equal(
      (await call("patch", `${BASE}/${doc._id}`, token, { followUpStatus: "nope" })).status,
      400
    );
    assert.equal((await call("patch", `${BASE}/${doc._id}`, token, {})).status, 400);
  });
});

describe("revealing the number", () => {
  it("returns it for an enquiry that asked for a person, and logs who looked", async () => {
    const doc = await seed(HASH, { sport: "Tennis" });
    await enquiries.markFollowUpRequested(HASH, "q", { summary: "call me" });
    await enquiries.attachContactNumber(HASH, PHONE);
    const token = await signedInAdmin(["notifications:manage"]);

    const res = await call("post", `${BASE}/${doc._id}/reveal-contact`, token, {});
    assert.equal(res.status, 200);
    assert.equal(res.body.data.phone, PHONE);
    assert.equal(res.headers["cache-control"], "no-store");

    const log = await AdminAuditLog.findOne({
      action: "whatsapp-pilot.enquiries.reveal-contact",
    }).lean();
    assert.ok(log);
    assert.equal(String(log.targetId), String(doc._id));
    assert.ok(!JSON.stringify(log).includes(PHONE));
  });

  it("answers 404, and logs nothing, when no number is kept", async () => {
    const doc = await seed(HASH, { sport: "Tennis" });
    const token = await signedInAdmin(["notifications:manage"]);
    const res = await call("post", `${BASE}/${doc._id}/reveal-contact`, token, {});
    assert.equal(res.status, 404);
    assert.equal(
      await AdminAuditLog.countDocuments({ action: "whatsapp-pilot.enquiries.reveal-contact" }),
      0
    );
  });
});

describe("the CSV", () => {
  it("has the columns the pilot review asked for, and logs the export", async () => {
    await seed(HASH, { childAge: 11, sport: "Tennis", level: "beginner", objective: "fun" });
    const token = await signedInAdmin(["notifications:view"]);
    const res = await call("get", `${BASE}/export.csv`, token);

    assert.match(res.headers["content-type"], /text\/csv/);
    assert.match(res.headers["content-disposition"], /attachment/);
    const [header, row] = res.text.replace(/^﻿/, "").split("\r\n");
    assert.equal(
      header,
      "Reference,Date,Parent,Question,Child age,Sport,Level,Objective,Guidance provided,Assistance required,Follow-up status,Parent feedback,Closed,Messages,Team note"
    );
    assert.ok(row.includes("Tennis"));
    assert.equal(
      await AdminAuditLog.countDocuments({ action: "whatsapp-pilot.enquiries.export" }),
      1
    );
  });

  it("neutralises cells a spreadsheet would run as a formula, and quotes commas and newlines", () => {
    assert.equal(admin.csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
    assert.equal(admin.csvCell("+91 98"), "'+91 98");
    assert.equal(admin.csvCell("@SUM(A1)"), "'@SUM(A1)");
    assert.equal(admin.csvCell("-1+1"), "'-1+1");
    assert.equal(admin.csvCell('say "hi", ok'), '"say ""hi"", ok"');
    assert.equal(admin.csvCell("a\nb"), '"a\nb"');
    assert.equal(admin.csvCell(undefined), "");
    assert.equal(admin.csvCell(11), "11");
  });
});

describe("migration 69 (indexes)", () => {
  const coll = () => mongoose.connection.db.collection("whatsappenquiries");
  const names = async (): Promise<string[]> =>
    (await coll().indexes()).map((i: { name: string }) => i.name);

  it("matches the model, so the two cannot drift", () => {
    const fromModel = WhatsAppEnquiry.schema
      .indexes()
      .map(([key]: [Record<string, number>]) => key);
    for (const spec of WHATSAPP_ENQUIRY_ADMIN_INDEXES) {
      assert.ok(
        fromModel.some(
          (key: Record<string, number>) => JSON.stringify(key) === JSON.stringify(spec.key)
        ),
        `the model declares ${spec.name}`
      );
    }
  });

  it("creates both, runs twice harmlessly, and reverts", async () => {
    await coll()
      .drop()
      .catch(() => undefined);
    const db = mongoose.connection.db;

    await up({}, db);
    assert.equal((await db.listCollections({ name: "whatsappenquiries" }).toArray()).length, 0);

    await up({ apply: true }, db);
    await up({ apply: true }, db);
    for (const spec of WHATSAPP_ENQUIRY_ADMIN_INDEXES)
      assert.ok((await names()).includes(spec.name));

    await down({ apply: true }, db);
    for (const spec of WHATSAPP_ENQUIRY_ADMIN_INDEXES)
      assert.ok(!(await names()).includes(spec.name));
  });
});

describe("the full conversation", () => {
  const talk = async (hash: string) => {
    const doc = await seed(hash, { sport: "Tennis" }, "which sport suits my son?");
    await enquiries.recordTurn(
      hash,
      "and the fees?",
      "About 2000 a month.",
      new Date(Date.now() - 500)
    );
    return doc;
  };

  it("is on one enquiry, oldest first, and not in the list", async () => {
    const doc = await talk(HASH);
    const token = await signedInAdmin(["notifications:view"]);

    const detail = (await call("get", `${BASE}/${doc._id}`, token)).body.data;
    assert.deepEqual(
      detail.turns.map((t: { parent: string; assistant: string }) => [t.parent, t.assistant]),
      [
        ["which sport suits my son?", "Try the assessment."],
        ["and the fees?", "About 2000 a month."],
      ]
    );

    const list = (await call("get", BASE, token)).body.data;
    assert.equal(list.rows[0].turns, undefined, "the list stays light");
    assert.ok(
      !JSON.stringify(list).includes("Try the assessment."),
      "only the latest answer is in the list"
    );
  });

  it("puts every answer, not just the last, in the export", async () => {
    await talk(HASH);
    const token = await signedInAdmin(["notifications:view"]);
    const csv = (await call("get", `${BASE}/export.csv`, token)).text;
    assert.ok(csv.includes("Try the assessment."));
    assert.ok(csv.includes("About 2000 a month."));
  });

  it("does not return the conversation from a status or note change", async () => {
    const doc = await talk(HASH);
    const token = await signedInAdmin(["notifications:manage"]);
    const res = await call("patch", `${BASE}/${doc._id}`, token, { teamNote: "called" });
    assert.equal(res.body.data.turns, undefined);
  });
});
