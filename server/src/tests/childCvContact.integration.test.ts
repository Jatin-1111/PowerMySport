// The sporting CV as a PDF, and a coach asking a family to get in touch. Requests go through the
// real `app`. Email is caught at the transport, so what is checked is the message that would have
// been sent; storage is replaced by a recorder.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";
process.env.FRONTEND_URL = "https://powermysport.test";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const express = require("express");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const { MemoryStore } = require("express-rate-limit");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const { User } = require("../client/models/User");
const { Player } = require("../client/models/Player");
const { ChildEvent } = require("../client/models/ChildEvent");
const { ChildAcademicProfile } = require("../client/models/ChildAcademicProfile");
const { ChildVideo } = require("../client/models/ChildVideo");
const { ChildShare } = require("../client/models/ChildShare");
const { ContactRequest } = require("../client/models/ContactRequest");
const { SeasonPlan } = require("../client/models/SeasonPlan");
const { extractPdfText } = require("../admin/services/dataSourceExtraction/pdfText");
const { createContactRequestRateLimiter } = require("../middleware/rateLimit");
const {
  CHILD_SHARE_NOTICE,
  CHILD_SHARE_SECTIONS,
  CHILD_HISTORY_LIMITS,
} = require("@powermysport/shared-types");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

let mongod: { getUri(): string; stop(): Promise<void> };

interface Sent {
  to: string;
  subject: string;
  html: string;
  text: string;
  [key: string]: unknown;
}
const sent: Sent[] = [];
let failSend = false;
const realCreateTransport = nodemailer.createTransport;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([
    ChildShare.init(),
    ChildVideo.init(),
    ChildEvent.init(),
    ContactRequest.init(),
  ]);
  nodemailer.createTransport = () => ({
    sendMail: async (options: Sent) => {
      if (failSend) throw new Error("smtp down");
      sent.push(options);
      return { messageId: "m1", rejected: [] };
    },
  });
});

after(async () => {
  nodemailer.createTransport = realCreateTransport;
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  sent.length = 0;
  failSend = false;
  for (const model of [
    ContactRequest,
    ChildShare,
    ChildVideo,
    ChildEvent,
    ChildAcademicProfile,
    SeasonPlan,
    Player,
    User,
  ]) {
    await model.deleteMany({});
  }
  await mongoose.connection.db.collection("playerrankinglinks").deleteMany({});
  await mongoose.connection.db.collection("rankingentries").deleteMany({});
});

let counter = 0;
const PARENT_EMAIL = (n: number) => `private.parent.${n}@example.test`;
const SECRET = {
  dob: "2011-03-04",
  city: "Hiddenville",
  regNo: "REGSECRET99",
  tag: "secrettraitword",
};

const parentWithChild = async () => {
  const userId = oid();
  counter += 1;
  await User.collection.insertOne({
    _id: userId,
    name: "Parent Person",
    email: PARENT_EMAIL(counter),
    phone: `8${String(counter).padStart(9, "0")}`,
    role: "Parent",
    isActive: true,
    status: "ACTIVE",
  });
  const childId = oid();
  await Player.collection.insertOne({
    _id: childId,
    userId,
    name: "Anaya Rao",
    dob: new Date(`${SECRET.dob}T00:00:00.000Z`),
    age: 15,
    location: "Maharashtra",
    homeCity: SECRET.city,
    yearsPlaying: 5,
    experienceLevel: "competitive",
    sportsFocus: ["Tennis"],
    personalityTags: [SECRET.tag],
  });
  const token = generateToken({
    id: userId.toString(),
    email: PARENT_EMAIL(counter),
    role: "Parent",
  });
  return {
    userId: userId.toString(),
    childId: childId.toString(),
    token,
    _userId: userId,
    _childId: childId,
    email: PARENT_EMAIL(counter),
  };
};

type Parent = Awaited<ReturnType<typeof parentWithChild>>;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const seed = async (p: Parent) => {
  await ChildEvent.create([
    {
      childId: p._childId,
      userId: p._userId,
      kind: "tournament_result",
      title: "Pune Open",
      resultLabel: "Quarter final",
      occurredOn: new Date("2026-03-01"),
      datePrecision: "month",
      resultUrl: "https://example.org/draw",
    },
    {
      childId: p._childId,
      userId: p._userId,
      kind: "award",
      title: "Club champion",
      occurredOn: new Date("2025-06-01"),
      datePrecision: "month",
    },
    {
      childId: p._childId,
      userId: p._userId,
      kind: "test_score",
      title: "SAT",
      resultLabel: "1380",
      occurredOn: new Date("2026-05-01"),
      datePrecision: "month",
    },
    {
      childId: p._childId,
      userId: p._userId,
      kind: "coaching_period",
      title: "Ace Academy",
      occurredOn: new Date("2022-01-01"),
      endedOn: new Date("2024-01-01"),
      datePrecision: "year",
    },
  ]);
  await ChildAcademicProfile.create({
    childId: p._childId,
    userId: p._userId,
    board: "CBSE",
    graduationYear: new Date().getUTCFullYear() + 3,
    school: "City School",
    intendedField: "Engineering",
  });
  await mongoose.connection.db.collection("playerrankinglinks").insertOne({
    userId: p._userId,
    dependentId: p._childId,
    sportSlug: "tennis",
    federationCode: "AITA",
    regNo: SECRET.regNo,
    verificationMethod: "DOB_CHALLENGE",
    verifiedAt: new Date(),
  });
  await mongoose.connection.db.collection("rankingentries").insertOne({
    sportSlug: "tennis",
    regNo: SECRET.regNo,
    isLatest: true,
    rank: 150,
    fullName: "Anaya Real Surname",
    category: "U14",
    subcategory: "Girls",
    totalPoints: 120,
    asOnDate: new Date("2026-10-20T00:00:00.000Z"),
  });
  await ChildVideo.create({
    childId: p._childId,
    userId: p._userId,
    status: "ready",
    title: "Final set",
    storageKey: `child-videos/${p.childId}/x.mp4`,
    contentType: "video/mp4",
    declaredBytes: 1000,
    sizeBytes: 1000,
    durationSeconds: 65,
  });
};

const make = (p: Parent, sections: string[] = [...CHILD_SHARE_SECTIONS]) =>
  request(app)
    .post(`/api/child-history/${p.childId}/shares`)
    .set(auth(p.token))
    .send({ recipientLabel: "Coach Miller, State University", sections, consent: true });

const tokenOf = (url: string): string => url.split("/share/")[1] as string;

/** A link and the profile behind it. */
const linked = async (sections?: string[]) => {
  const p = await parentWithChild();
  await seed(p);
  const created = await make(p, sections);
  return { p, token: tokenOf(created.body.data.url), shareId: created.body.data.share.id };
};

/** The PDF's text with every space and line break removed, so a word split across runs still matches. */
const pdfText = async (buffer: Buffer): Promise<string> => {
  const read = await extractPdfText(buffer);
  assert.ok(read, "the PDF has a readable text layer");
  return read.text.replace(/\s+/g, "");
};
const squash = (value: string) => value.replace(/\s+/g, "");

const getPdf = (path: string, headers: Record<string, string> = {}) =>
  request(app)
    .get(path)
    .set(headers)
    .buffer(true)
    .parse(
      (
        res: NodeJS.ReadableStream & { setEncoding(e: string): void },
        cb: (e: Error | null, b: Buffer) => void
      ) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      }
    );

describe("the CV from a link", () => {
  it("is a PDF download named for the child, never cached, and not counted as an open", async () => {
    const { token } = await linked();
    const res = await getPdf(`/api/share/${token}/cv.pdf`);

    assert.equal(res.status, 200);
    assert.equal(res.headers["content-type"], "application/pdf");
    assert.equal(
      res.headers["content-disposition"],
      'attachment; filename="anaya-rao-sporting-profile.pdf"'
    );
    assert.equal(res.headers["cache-control"], "no-store");
    assert.equal(res.headers["x-robots-tag"], "noindex, nofollow, noarchive");
    assert.equal(res.body.subarray(0, 5).toString(), "%PDF-");
    assert.equal((await ChildShare.findOne({}).lean()).openCount, 0);
  });

  it("holds the same entries, labels and notice as the page, for the ticked sections", async () => {
    const { token } = await linked();
    const page = (await request(app).get(`/api/share/${token}`)).body.data;
    const text = await pdfText((await getPdf(`/api/share/${token}/cv.pdf`)).body);

    for (const row of page.timeline) {
      assert.ok(text.includes(squash(row.title)), `the PDF is missing "${row.title}"`);
      if (row.resultLabel)
        assert.ok(text.includes(squash(row.resultLabel)), `missing result ${row.resultLabel}`);
    }
    assert.ok(text.includes(squash(page.child.name)));
    assert.ok(text.includes(squash(CHILD_SHARE_NOTICE)));
    assert.ok(text.includes("Parentrecord,linkprovided"));
    assert.ok(text.includes("FromtheAITArankinglist"));
    assert.ok(text.includes(`Classof${page.child.classYear}`));
    for (const fact of ["CBSE", "CitySchool", "Engineering"]) assert.ok(text.includes(fact), fact);
    assert.ok(
      text.includes("Finalset") && text.includes("Thevideosareontheshared page".replace(/\s+/g, ""))
    );
    assert.ok(text.includes("Yearsinsport:5"));
  });

  it("leaves out what was not ticked, and the figures behind it", async () => {
    const { token } = await linked(["awards"]);
    const text = await pdfText((await getPdf(`/api/share/${token}/cv.pdf`)).body);
    assert.ok(text.includes("Clubchampion"));
    for (const hidden of [
      "PuneOpen",
      "SAT",
      "CitySchool",
      "AceAcademy",
      "Ranked150",
      "Finalset",
      "Tournaments:",
      "Classof",
    ]) {
      assert.ok(!text.includes(hidden), `"${hidden}" is in a CV that did not tick it`);
    }
  });

  it("contains none of the private values planted in the child's data, and not the link", async () => {
    const { token, p } = await linked();
    const text = await pdfText((await getPdf(`/api/share/${token}/cv.pdf`)).body);
    const raw = (await getPdf(`/api/share/${token}/cv.pdf`)).body.toString("latin1");

    for (const [what, value] of Object.entries({
      "the date of birth": SECRET.dob,
      "the parent's email": p.email,
      "a home city": SECRET.city,
      "a registration number": SECRET.regNo,
      "a personality tag": SECRET.tag,
      "the ranking surname": "RealSurname",
      "the link": token,
      "the share path": "/share/",
    })) {
      assert.ok(!text.includes(squash(value)), `${what} appears in the CV`);
      assert.ok(!raw.includes(value), `${what} appears in the PDF file`);
    }
  });

  it("runs onto further pages when there is a lot, with the page number on each", async () => {
    const p = await parentWithChild();
    await ChildEvent.collection.insertMany(
      Array.from({ length: 70 }, (_, i) => ({
        childId: p._childId,
        userId: p._userId,
        kind: "tournament_result",
        title: `Event number ${i}`,
        detail: "A short note about how the day went and who was played.",
        occurredOn: new Date(2026, 0, 1 + i),
        datePrecision: "day",
      }))
    );
    const token = tokenOf((await make(p, ["results"])).body.data.url);
    const text = await pdfText((await getPdf(`/api/share/${token}/cv.pdf`)).body);
    assert.ok(/Page2of\d/.test(text), "a second page was started");
    assert.ok(
      text.includes("Eventnumber0") && text.includes("Eventnumber69"),
      "nothing was lost across pages"
    );
  });

  it("answers 404 for a link never issued and 410 for one that is over, and makes nothing", async () => {
    const { token, p, shareId } = await linked();
    assert.equal((await request(app).get(`/api/share/${"z".repeat(43)}/cv.pdf`)).status, 404);
    await request(app)
      .delete(`/api/child-history/${p.childId}/shares/${shareId}`)
      .set(auth(p.token));
    const gone = await request(app).get(`/api/share/${token}/cv.pdf`);
    assert.equal(gone.status, 410);
    assert.match(gone.body.message, /no longer active/);
  });
});

describe("the parent's own CV", () => {
  const cv = (p: Parent, query: string, headers = auth(p.token)) =>
    getPdf(`/api/child-history/${p.childId}/cv.pdf${query}`, headers);

  it("downloads for the sections chosen, and makes no link", async () => {
    const p = await parentWithChild();
    await seed(p);
    const res = await cv(p, "?sections=results,academics");
    assert.equal(res.status, 200);
    assert.equal(res.headers["content-type"], "application/pdf");
    assert.equal(res.headers["cache-control"], "no-store");
    const text = await pdfText(res.body);
    assert.ok(text.includes("PuneOpen") && text.includes("SAT") && text.includes("CitySchool"));
    assert.ok(!text.includes("Clubchampion"));
    assert.equal(await ChildShare.countDocuments({}), 0);
  });

  it("needs a sign-in, and answers 404 for another parent's child", async () => {
    const owner = await parentWithChild();
    const stranger = await parentWithChild();
    assert.equal(
      (await getPdf(`/api/child-history/${owner.childId}/cv.pdf?sections=results`)).status,
      401
    );
    assert.equal((await cv(owner, "?sections=results", auth(stranger.token))).status, 404);
  });

  it("refuses a missing or unknown choice", async () => {
    const p = await parentWithChild();
    for (const query of [
      "",
      "?sections=",
      "?sections=injuries",
      "?sections=results,medical",
      "?sections=results&videoIds=nope",
      "?sections=results&extra=1",
    ]) {
      assert.equal((await cv(p, query)).status, 400, query);
    }
  });
});

const ask = (token: string, body: Record<string, unknown>) =>
  request(app).post(`/api/share/${token}/contact`).send(body);
const valid = {
  name: "Coach Miller",
  email: "Miller@University.edu",
  message: "We would like to talk about a visit.",
};

describe("asking the family to get in touch", () => {
  it("tells the family by email, keeps the request, and tells the coach only that it was sent", async () => {
    const { token, p } = await linked();
    const res = await ask(token, valid);

    assert.equal(res.status, 201);
    assert.deepEqual(res.body, { success: true, data: { sent: true } });
    assert.ok(
      !JSON.stringify(res.body).includes(p.email),
      "the family's address is not in the reply"
    );

    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.to, p.email, "it goes to the parent's own address");
    assert.match(sent[0]!.subject, /Someone asked to contact you about Anaya Rao's profile/);
    for (const part of [
      "Coach Miller",
      "miller@university.edu",
      "Coach Miller, State University",
      "visit",
    ]) {
      assert.ok(sent[0]!.text.includes(part), `the email lacks ${part}`);
      assert.ok(sent[0]!.html.includes(part), `the html lacks ${part}`);
    }
    assert.match(sent[0]!.text, /has not checked who this is/);
    assert.match(sent[0]!.text, /Your email address has not been shared with them/);
    assert.match(sent[0]!.html, /href="mailto:miller@university\.edu"/);
    assert.equal(sent[0]!.replyTo, undefined, "replying is the parent's choice, not a header");

    const stored = await ContactRequest.findOne({}).lean();
    assert.equal(stored.email, "miller@university.edu");
    assert.equal(stored.name, "Coach Miller");
    assert.equal(String(stored.childId), p.childId);
  });

  it("needs no sign-in", async () => {
    const { token } = await linked();
    assert.equal((await ask(token, valid)).status, 201);
  });

  it("cannot be used to address someone else, change the subject or add a header", async () => {
    const { token, p } = await linked();
    const attempts = [
      { ...valid, name: "Eve\r\nBcc: evil@example.com", email: "eve@example.com" },
      { ...valid, message: "hi\r\nTo: evil@example.com\r\nSubject: pwned" },
      { ...valid, email: "eve@example.com", name: '"><img src=x onerror=alert(1)>' },
    ];
    for (const body of attempts) {
      sent.length = 0;
      await ContactRequest.deleteMany({});
      const res = await ask(token, body);
      assert.equal(res.status, 201);
      const mail = sent[0]!;
      assert.equal(mail.to, p.email);
      assert.equal(mail.bcc, undefined);
      assert.equal(mail.cc, undefined);
      assert.ok(!/pwned/.test(mail.subject));
      assert.ok(!/[\r\n]/.test(mail.subject));
      assert.ok(!/<img|<script/i.test(mail.html), "what they typed is not markup in the email");
    }
  });

  it("refuses an address that names a second recipient or is not one address", async () => {
    const { token } = await linked();
    for (const email of [
      "a@b.co, evil@x.com",
      "a@b.co;evil@x.com",
      'a"b@x.co',
      "a b@x.co",
      "nope",
      "a@b",
      "<a@b.co>",
    ]) {
      const res = await ask(token, { ...valid, email });
      assert.equal(res.status, 400, email);
    }
    assert.equal(sent.length, 0);
    assert.equal(await ContactRequest.countDocuments({}), 0);
  });

  it("refuses a missing name, a too-long message and fields it does not take", async () => {
    const { token } = await linked();
    assert.equal((await ask(token, { ...valid, name: "   " })).status, 400);
    assert.equal((await ask(token, { email: valid.email })).status, 400);
    assert.equal(
      (
        await ask(token, {
          ...valid,
          message: "x".repeat(CHILD_HISTORY_LIMITS.contactMessageChars + 1),
        })
      ).status,
      400
    );
    for (const extra of [
      { to: "evil@x.com" },
      { subject: "hi" },
      { userId: "x" },
      { childId: "x" },
    ]) {
      assert.equal((await ask(token, { ...valid, ...extra })).status, 400);
    }
    assert.equal(sent.length, 0);
  });

  it("accepts a request with no message", async () => {
    const { token } = await linked();
    const res = await ask(token, { name: "Coach", email: "coach@u.edu" });
    assert.equal(res.status, 201);
    assert.ok(!/Message/.test(sent[0]!.text));
  });

  it("answers as sent, but does not email the parent twice, when the same address asks again within a day", async () => {
    const { token } = await linked();
    assert.equal((await ask(token, valid)).status, 201);
    assert.equal((await ask(token, { ...valid, message: "again" })).status, 201);
    assert.equal(sent.length, 1);
    assert.equal(await ContactRequest.countDocuments({}), 1);
  });

  it("takes at most ten requests for one link, counted in the database", async () => {
    const { token } = await linked();
    for (let i = 0; i < CHILD_HISTORY_LIMITS.contactRequestsPerShare; i += 1) {
      assert.equal((await ask(token, { ...valid, email: `coach${i}@u.edu` })).status, 201);
    }
    const over = await ask(token, { ...valid, email: "one-too-many@u.edu" });
    assert.equal(over.status, 429);
    assert.match(over.body.message, /all the requests it can/);
    assert.equal(sent.length, 10);
  });

  it("does nothing for a link that is over or was never issued", async () => {
    const { token, p, shareId } = await linked();
    assert.equal((await ask("y".repeat(43), valid)).status, 404);
    await request(app)
      .delete(`/api/child-history/${p.childId}/shares/${shareId}`)
      .set(auth(p.token));
    assert.equal((await ask(token, valid)).status, 410);
    assert.equal(sent.length, 0);
    assert.equal(await ContactRequest.countDocuments({}), 0);
  });

  it("tells the coach, and keeps nothing, when the email cannot be sent", async () => {
    const { token } = await linked();
    failSend = true;
    const res = await ask(token, valid);
    assert.equal(res.status, 502);
    assert.match(res.body.message, /could not be sent/);
    assert.equal(
      await ContactRequest.countDocuments({}),
      0,
      "a request the family never saw is not kept"
    );

    failSend = false;
    assert.equal((await ask(token, valid)).status, 201, "and trying again works");
    assert.equal(sent.length, 1);
  });

  it("is tied to the limits: per source, per link and a tight hourly one for requests", async () => {
    const {
      contactRequestRateLimiter,
      publicShareRateLimiter,
      publicShareTokenRateLimiter,
    } = require("../middleware/rateLimit");
    const router = require("../client/routes/childShareRoutes").default;
    const layer = router.stack.find(
      (l: { route?: { path: string } }) => l.route?.path === "/:token/contact"
    );
    const handles = layer.route.stack.map((s: { handle: unknown }) => s.handle);
    for (const limiter of [
      publicShareRateLimiter,
      publicShareTokenRateLimiter,
      contactRequestRateLimiter,
    ]) {
      assert.ok(handles.includes(limiter));
    }
  });

  it("stops one source after a few requests an hour", async () => {
    const server = express();
    server.post(
      "/contact",
      createContactRequestRateLimiter(new MemoryStore(), 3),
      (_req: unknown, res: { json(b: unknown): void }) => res.json({ ok: true })
    );
    const statuses = [];
    for (let i = 0; i < 5; i += 1) statuses.push((await request(server).post("/contact")).status);
    assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
  });

  it("is removed with the child", async () => {
    const { token, p } = await linked();
    await ask(token, valid);
    assert.equal(await ContactRequest.countDocuments({}), 1);
    const { deleteDependent } = require("../shared/services/AuthService/dependents");
    await deleteDependent(p.userId, p.childId);
    assert.equal(await ContactRequest.countDocuments({}), 0);
  });
});
