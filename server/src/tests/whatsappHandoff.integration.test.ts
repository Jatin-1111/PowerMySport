/* eslint-disable @typescript-eslint/no-var-requires */
// Moving a new parent's WhatsApp notes onto their website profile: the link, the review
// preview, and the confirmation that creates children. Real (in-memory) MongoDB and the real
// routes; nothing here touches any other database.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";
process.env.FRONTEND_URL = "https://site.example.test";

import assert = require("node:assert/strict");
const crypto = require("crypto");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const { User } = require("../client/models/User");
const { Player } = require("../client/models/Player");
const { WhatsAppNote } = require("../client/models/WhatsAppNote");
const notes = require("../shared/services/whatsappNotes");
const handoff = require("../shared/services/whatsappHandoff");
const { ASSISTANT_CHAT_TOOLS } = require("../shared/services/chatToolsService");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();
let mongod: { getUri(): string; stop(): Promise<void> };

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await WhatsAppNote.init();
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  await Promise.all([
    WhatsAppNote.deleteMany({}),
    User.collection.deleteMany({}),
    Player.deleteMany({}),
  ]);
});

const HASH = "hash-new-parent";

/** A signed-in parent, inserted directly so the test controls consent and role. */
const seedParent = async (over: Record<string, unknown> = {}) => {
  const _id = oid();
  const email = `${_id}@example.test`;
  await User.collection.insertOne({
    _id,
    name: "Meera Kapoor",
    email,
    phone: `98${Math.floor(10000000 + Math.random() * 89999999)}`,
    role: "Parent",
    isActive: true,
    status: "ACTIVE",
    ...over,
  });
  return {
    id: _id.toString(),
    token: generateToken({ id: _id.toString(), email, role: over.role ?? "Parent" }),
  };
};

const tokenFromUrl = (url: string): string => new URL(url).searchParams.get("t") ?? "";

/** Notes for a number, and a live link for them. Returns the token. */
const linkFor = async (hash = HASH, children: Array<Record<string, unknown>> = []) => {
  const list = children.length
    ? children
    : [
        {
          childName: "Vikrant",
          age: 14,
          sports: ["Tennis"],
          goal: "play state level",
          level: "intermediate",
          state: "Delhi",
        },
      ];
  for (const child of list) await notes.saveChildNote(hash, child);
  const made = await handoff.createProfileLink(hash);
  assert.equal(made.created, true);
  return tokenFromUrl(made.url);
};

const claim = (token: string, auth: string | null, body: Record<string, unknown>) => {
  const req = request(app).post("/api/whatsapp-notes/claim");
  if (auth) req.set("Authorization", `Bearer ${auth}`);
  return req.send({ token, ...body });
};

const preview = (token: string) => request(app).get("/api/whatsapp-notes/preview").query({ token });

const kid = (key: string, over: Record<string, unknown> = {}) => ({
  key,
  dob: "2012-12-01",
  ...over,
});

describe("making the link", () => {
  it("makes a link to the website for a number that has notes, valid for a week", async () => {
    await notes.saveChildNote(HASH, { childName: "Vikrant", age: 14 });
    const made = await handoff.createProfileLink(HASH, new Date("2026-10-22T00:00:00Z"));
    assert.equal(made.created, true);
    assert.match(made.url, /^https:\/\/site\.example\.test\/start\?t=[\w-]+\.[\w-]+$/);
    assert.equal(made.days, 7);

    const note = await WhatsAppNote.findOne({ phoneHash: HASH }).lean();
    assert.equal(new Date(note.linkExpiresAt).toISOString(), "2026-10-29T00:00:00.000Z");
  });

  it("makes nothing for a number with no notes", async () => {
    assert.deepEqual(await handoff.createProfileLink("hash-nobody"), {
      created: false,
      reason: "nothing_noted",
    });
    assert.equal(await WhatsAppNote.countDocuments({}), 0, "no empty note is created");
  });

  it("does not put the phone hash or any name in the URL in a readable form", async () => {
    await notes.saveChildNote(HASH, { childName: "Vikrant" });
    const { url } = await handoff.createProfileLink(HASH);
    assert.ok(!url.includes("Vikrant"));
    assert.ok(!url.includes(HASH), "the hash is inside the signed token, not plain in the URL");
  });
});

describe("the create_profile_link tool", () => {
  const tool = ASSISTANT_CHAT_TOOLS.find((t: { name: string }) => t.name === "create_profile_link");

  it("returns the link for a chat that has notes", async () => {
    await notes.saveChildNote(HASH, { childName: "Vikrant", age: 14, sports: ["Tennis"] });
    const out = await tool.execute({}, { phoneHash: HASH });
    assert.equal(out.created, true);
    assert.match(out.link, /\/start\?t=/);
    assert.match(out.instruction, /nothing is saved to a profile until they confirm/);
  });

  it("says there is nothing to carry over when nothing is noted", async () => {
    const out = await tool.execute({}, { phoneHash: HASH });
    assert.equal(out.created, false);
    assert.equal(out.reason, "nothing_noted");
  });

  it("works for a number with an account too, carrying a new child to the profile by link", async () => {
    await notes.saveChildNote(HASH, { childName: "Riya", age: 9 });
    const out = await tool.execute({}, { userId: "u1", phoneHash: HASH });
    assert.equal(out.created, true);
    assert.match(out.link, /\/start\?t=/);
  });

  it("is not offered outside a WhatsApp chat", async () => {
    assert.equal((await tool.execute({}, {})).reason, "no_chat");
    assert.equal((await tool.execute({}, { userId: "u1" })).reason, "no_chat");
  });
});

describe("the review preview", () => {
  it("shows what was kept, with suggestions to confirm, and never a phone number", async () => {
    const token = await linkFor();
    const res = await preview(token);

    assert.equal(res.status, 200);
    const [child] = res.body.data.children;
    assert.equal(child.firstName, "Vikrant");
    assert.equal(child.key, "vikrant");
    assert.equal(child.ageText, "14");
    assert.deepEqual(child.sports, ["Tennis"]);
    assert.equal(child.suggestedAmbition, "competitive");
    assert.equal(child.suggestedExperience, "intermediate");
    assert.ok(!JSON.stringify(res.body).includes(HASH));
    assert.ok(!/phone/i.test(JSON.stringify(res.body)));
  });

  it("is never cached and is not passed on to other sites", async () => {
    const res = await preview(await linkFor());
    assert.equal(res.headers["cache-control"], "no-store");
    assert.equal(res.headers["referrer-policy"], "no-referrer");
  });

  it("refuses a missing, garbled or tampered link with 400", async () => {
    const good = await linkFor();
    const [body = "", sig = ""] = good.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), h: "hash-other" })
    ).toString("base64url");

    for (const bad of ["", "nonsense", `${forged}.${sig}`, `${body}.AAAA`, `${good}.extra`]) {
      const res = await preview(bad);
      assert.equal(res.status, 400, `"${bad.slice(0, 20)}" should be refused`);
    }
  });

  it("refuses a link signed for some other purpose", async () => {
    await notes.saveChildNote(HASH, { childName: "Vikrant" });
    await handoff.createProfileLink(HASH);
    const note = await WhatsAppNote.findOne({ phoneHash: HASH }).lean();
    const body = Buffer.from(
      JSON.stringify({ h: HASH, n: note.linkNonce, e: Date.now() + 100000 })
    ).toString("base64url");
    // Same secret, no domain label: what a token made for another feature would look like.
    const wrongDomain = crypto
      .createHmac("sha256", process.env.JWT_SECRET)
      .update(body)
      .digest("base64url");
    assert.equal((await preview(`${body}.${wrongDomain}`)).status, 400);
  });

  it("answers an expired link with 410 and tells the parent to ask again", async () => {
    await notes.saveChildNote(HASH, { childName: "Vikrant" });
    const made = await handoff.createProfileLink(HASH, new Date("2020-01-01T00:00:00Z"));
    const res = await preview(tokenFromUrl(made.url));
    assert.equal(res.status, 410);
    assert.match(res.body.message, /expired/);
    assert.match(res.body.message, /WhatsApp/);
  });

  it("stops an older link working once a newer one is made", async () => {
    const first = await linkFor();
    const second = tokenFromUrl((await handoff.createProfileLink(HASH)).url);
    assert.equal((await preview(first)).status, 410);
    assert.match((await preview(first)).body.message, /newer link/);
    assert.equal((await preview(second)).status, 200);
  });

  it("stops working when the chat's notes are deleted (STOP)", async () => {
    const token = await linkFor();
    await notes.forgetAllNotes(HASH);
    assert.equal((await preview(token)).status, 410);
  });
});

describe("confirming (claim)", () => {
  it("needs a signed-in parent", async () => {
    const token = await linkFor();
    assert.equal((await claim(token, null, { children: [kid("vikrant")] })).status, 401);
    assert.equal((await WhatsAppNote.findOne({ phoneHash: HASH }).lean()).children.length, 1);
  });

  it("creates the child with the date of birth, sport and state, and empties the note", async () => {
    const parent = await seedParent();
    const token = await linkFor();

    const res = await claim(token, parent.token, {
      parentalConsent: true,
      children: [
        kid("vikrant", {
          gender: "MALE",
          ambition: "competitive",
          experienceLevel: "intermediate",
        }),
      ],
    });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.created, ["Vikrant"]);
    assert.equal(res.body.data.remaining, 0);

    const made = await Player.findOne({ userId: parent.id }).lean();
    assert.equal(made.name, "Vikrant");
    assert.deepEqual(made.sportsFocus, ["Tennis"]);
    assert.equal(made.location, "Delhi");
    assert.equal(made.ambition, "competitive");
    assert.equal(made.experienceLevel, "intermediate");
    assert.equal(new Date(made.dob).toISOString().slice(0, 10), "2012-12-01");

    assert.equal(
      await WhatsAppNote.countDocuments({ phoneHash: HASH }),
      0,
      "nothing is left behind"
    );
    assert.equal((await preview(token)).status, 410, "a finished import ends the link");
  });

  it("imports some children and leaves the others for later", async () => {
    const parent = await seedParent();
    const token = await linkFor(HASH, [
      { childName: "Vikrant", age: 14 },
      { childName: "Riya", age: 9 },
    ]);

    const res = await claim(token, parent.token, {
      parentalConsent: true,
      children: [kid("vikrant")],
    });
    assert.deepEqual(res.body.data.created, ["Vikrant"]);
    assert.equal(res.body.data.remaining, 1);
    const left = (await preview(token)).body.data.children;
    assert.deepEqual(
      left.map((c: { key: string }) => c.key),
      ["riya"]
    );
  });

  it("asks for the Parental Consent policy, and creates nothing without it", async () => {
    const parent = await seedParent();
    const token = await linkFor();

    const res = await claim(token, parent.token, { children: [kid("vikrant")] });
    assert.equal(res.status, 428);
    assert.equal(await Player.countDocuments({ userId: parent.id }), 0);
    assert.equal((await WhatsAppNote.findOne({ phoneHash: HASH }).lean()).children.length, 1);
  });

  it("records the consent when the parent ticks the box", async () => {
    const parent = await seedParent();
    await claim(await linkFor(), parent.token, {
      parentalConsent: true,
      children: [kid("vikrant")],
    });
    const stored = await User.collection.findOne({ _id: new mongoose.Types.ObjectId(parent.id) });
    assert.equal(stored.legalConsents.parentalConsent.accepted, true);
  });

  it("tells a player account to switch to a parent profile", async () => {
    const player = await seedParent({ role: "Player" });
    const res = await claim(await linkFor(), player.token, {
      parentalConsent: true,
      children: [kid("vikrant")],
    });
    assert.equal(res.status, 403);
    assert.equal(await Player.countDocuments({}), 0);
  });

  it("does not add a child whose first name is already on the account, and clears it from the note", async () => {
    const parent = await seedParent();
    await Player.create({ userId: parent.id, name: "Vikrant Kapoor", sportsFocus: [] });
    const token = await linkFor();

    const res = await claim(token, parent.token, {
      parentalConsent: true,
      children: [kid("vikrant")],
    });
    assert.deepEqual(res.body.data.skipped, ["Vikrant"]);
    assert.deepEqual(res.body.data.created, []);
    assert.equal(await Player.countDocuments({ userId: parent.id }), 1);
  });

  it("refuses a date of birth that is not a child's, and keeps the child in the note", async () => {
    const parent = await seedParent();
    const token = await linkFor();

    for (const dob of ["2000-01-01", "2099-01-01", "2026-13-45"]) {
      const res = await claim(token, parent.token, {
        parentalConsent: true,
        children: [kid("vikrant", { dob })],
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.created.length, 0, `${dob} must not create a child`);
      assert.equal(res.body.data.failed[0].name, "Vikrant");
    }
    assert.equal(await Player.countDocuments({ userId: parent.id }), 0);
    assert.equal((await preview(token)).body.data.children.length, 1, "the parent can try again");
  });

  it("creates a child once when two confirmations arrive together", async () => {
    const parent = await seedParent();
    const token = await linkFor();
    const send = () =>
      claim(token, parent.token, { parentalConsent: true, children: [kid("vikrant")] });

    const [a, b] = await Promise.all([send(), send()]);
    assert.equal(await Player.countDocuments({ userId: parent.id }), 1);
    const created = [a, b].flatMap((r) => r.body.data?.created ?? []);
    assert.equal(created.length, 1, "exactly one of the two got the child");
  });

  it("cannot reach another number's children with a link of its own", async () => {
    const parent = await seedParent();
    await notes.saveChildNote("hash-someone-else", { childName: "Secret", age: 10 });
    const token = await linkFor();

    const res = await claim(token, parent.token, {
      parentalConsent: true,
      children: [kid("secret")],
    });
    assert.deepEqual(res.body.data.missing, ["secret"]);
    assert.equal(await Player.countDocuments({ userId: parent.id }), 0);
    assert.equal(
      (await notes.getNotes("hash-someone-else")).length,
      1,
      "the other note is untouched"
    );
  });

  it("claiming the same child twice creates it once", async () => {
    const parent = await seedParent();
    const token = await linkFor(HASH, [
      { childName: "Vikrant", age: 14 },
      { childName: "Riya", age: 9 },
    ]);
    const body = { parentalConsent: true, children: [kid("vikrant")] };
    await claim(token, parent.token, body);
    const again = await claim(token, parent.token, body);
    assert.deepEqual(again.body.data.missing, ["vikrant"]);
    assert.equal(await Player.countDocuments({ userId: parent.id, name: "Vikrant" }), 1);
  });

  it("refuses a bad request before touching the note", async () => {
    const parent = await seedParent();
    const token = await linkFor();
    for (const body of [
      { children: [] },
      { children: [{ key: "vikrant" }] },
      { children: [{ key: "vikrant", dob: "01/12/2012" }] },
      { children: [kid("vikrant", { ambition: "world-domination" })] },
    ]) {
      assert.equal((await claim(token, parent.token, body)).status, 400);
    }
    assert.equal((await WhatsAppNote.findOne({ phoneHash: HASH }).lean()).children.length, 1);
  });

  it("will not use a bad link, even for a signed-in parent", async () => {
    const parent = await seedParent();
    const res = await claim("nonsense-token-value", parent.token, {
      parentalConsent: true,
      children: [kid("vikrant")],
    });
    assert.equal(res.status, 400);
  });
});

describe("suggestions", () => {
  it("suggests an ambition from the parent's own words, and nothing when unsure", () => {
    assert.equal(handoff.suggestAmbition("wants to turn professional"), "career");
    assert.equal(handoff.suggestAmbition("play for India at national level"), "national");
    assert.equal(handoff.suggestAmbition("win district tournaments"), "competitive");
    assert.equal(handoff.suggestAmbition("just for fun"), "fun");
    assert.equal(handoff.suggestAmbition("a good life"), undefined);
    assert.equal(handoff.suggestAmbition(undefined), undefined);
  });

  it("suggests an experience level, and nothing when unsure", () => {
    assert.equal(handoff.suggestExperience("complete beginner"), "beginner");
    assert.equal(handoff.suggestExperience("plays at the club"), "intermediate");
    assert.equal(handoff.suggestExperience("state level"), "competitive");
    assert.equal(handoff.suggestExperience("hard to say"), undefined);
  });
});
