// Notes about a new parent's children: what is saved, what is left out, who can see it, and what
// STOP removes. Real (in-memory) MongoDB; the model call is a stub.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { WhatsAppNote } = require("../client/models/WhatsAppNote");
const { WhatsAppConversation } = require("../client/models/WhatsAppConversation");
const { User } = require("../client/models/User");
const notes = require("../shared/services/whatsappNotes");
const { ASSISTANT_CHAT_TOOLS } = require("../shared/services/chatToolsService");
const {
  answerWhatsAppMessage,
  hashPhone,
  identityAddendum,
} = require("../shared/services/whatsappAssistantService");
const redis = require("../config/redis").default;

let mongod: { getUri(): string; stop(): Promise<void> };

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // The unique number index is what makes a raced save and a full note distinguishable.
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
    WhatsAppConversation.deleteMany({}),
    User.deleteMany({}),
  ]);
});

const HASH = "hash-parent-1";
const tool = (name: string) => ASSISTANT_CHAT_TOOLS.find((t: { name: string }) => t.name === name);

describe("saving a note", () => {
  it("saves a child from what the parent said, and keeps only the first name", async () => {
    const result = await notes.saveChildNote(HASH, {
      childName: "Vikrant Khandelwal",
      age: 14,
      sports: ["Tennis"],
      level: "intermediate",
      goal: "state level",
      state: "Delhi",
    });
    assert.equal(result.saved, true);
    assert.equal(result.created, true);

    const stored = await WhatsAppNote.findOne({ phoneHash: HASH }).lean();
    assert.equal(stored.children.length, 1);
    assert.equal(stored.children[0].firstName, "Vikrant");
    assert.equal(stored.children[0].key, "vikrant");
    assert.ok(!JSON.stringify(stored).includes("Khandelwal"));
  });

  it("updates the same child instead of duplicating, and keeps what was not mentioned", async () => {
    await notes.saveChildNote(HASH, { childName: "Vikrant", age: 14, sports: ["Tennis"] });
    const again = await notes.saveChildNote(HASH, { childName: "vikrant", goal: "state level" });

    assert.equal(again.saved, true);
    assert.equal(again.created, false);
    const stored = await WhatsAppNote.findOne({ phoneHash: HASH }).lean();
    assert.equal(stored.children.length, 1);
    assert.equal(stored.children[0].age, 14);
    assert.deepEqual(stored.children[0].sports, ["Tennis"]);
    assert.equal(stored.children[0].goal, "state level");
  });

  it("applies a correction to the age", async () => {
    await notes.saveChildNote(HASH, { childName: "Vikrant", age: 14 });
    await notes.saveChildNote(HASH, { childName: "Vikrant", age: 15 });
    const stored = await WhatsAppNote.findOne({ phoneHash: HASH }).lean();
    assert.equal(stored.children[0].age, 15);
  });

  it("refuses a fifth child, and says so", async () => {
    for (const name of ["Aa", "Bb", "Cc", "Dd"]) {
      assert.equal((await notes.saveChildNote(HASH, { childName: name })).saved, true);
    }
    const fifth = await notes.saveChildNote(HASH, { childName: "Ee" });
    assert.deepEqual(fifth, { saved: false, reason: "limit_reached" });
    assert.equal((await notes.getNotes(HASH)).length, 4);
  });

  it("still updates one of the four when the note is full", async () => {
    for (const name of ["Aa", "Bb", "Cc", "Dd"])
      await notes.saveChildNote(HASH, { childName: name });
    const update = await notes.saveChildNote(HASH, { childName: "Dd", age: 9 });
    assert.equal(update.saved, true);
    assert.equal(update.created, false);
  });

  it("does not lose a child when two messages arrive together", async () => {
    const results = await Promise.all([
      notes.saveChildNote(HASH, { childName: "Aarav", age: 12 }),
      notes.saveChildNote(HASH, { childName: "Riya", age: 9 }),
      notes.saveChildNote(HASH, { childName: "Aarav", sports: ["Tennis"] }),
    ]);
    assert.ok(results.every((r: { saved: boolean }) => r.saved));
    const children = await notes.getNotes(HASH);
    assert.deepEqual(children.map((c: { key: string }) => c.key).sort(), ["aarav", "riya"]);
    const aarav = children.find((c: { key: string }) => c.key === "aarav");
    assert.ok(aarav.age === 12 || aarav.sports.length === 1, "neither update may vanish silently");
  });

  it("asks for a name when there is none", async () => {
    assert.deepEqual(await notes.saveChildNote(HASH, { childName: "  " }), {
      saved: false,
      reason: "no_name",
    });
  });

  it("drops what is not plain: links, markup, a city passed as a state, an impossible age", async () => {
    await notes.saveChildNote(HASH, {
      childName: "Riya",
      age: 40,
      sports: ["<b>Swimming</b> https://evil.example/x", "Chess", "Tennis", "Golf", "Polo"],
      goal: "win\nhttps://evil.example",
      state: "Pune",
    });
    const [riya] = await notes.getNotes(HASH);
    assert.equal(riya.age, undefined, "an age of 40 is not a child's");
    assert.equal(riya.state, undefined, "a city is not a state");
    assert.equal(riya.sports.length, 3, "at most three sports");
    const text = JSON.stringify(riya);
    assert.ok(!text.includes("evil.example"));
    assert.ok(!text.includes("<"));
  });

  it("keeps a state the site accepts, whatever its spelling", async () => {
    await notes.saveChildNote(HASH, { childName: "Riya", state: "maharashtra" });
    assert.equal((await notes.getNotes(HASH))[0].state, "Maharashtra");
  });

  it("reads an old age as 'about', never as a fresh one", () => {
    const child = {
      age: 14,
      ageNotedAt: new Date("2025-10-22T00:00:00Z"),
    };
    assert.equal(notes.describeAge(child, new Date("2026-10-23T00:00:00Z")), "about 15");
    assert.equal(notes.describeAge(child, new Date("2025-11-22T00:00:00Z")), "14");
  });
});

describe("forgetting", () => {
  it("removes one child and leaves the other", async () => {
    await notes.saveChildNote(HASH, { childName: "Aarav" });
    await notes.saveChildNote(HASH, { childName: "Riya" });
    assert.equal(await notes.forgetChild(HASH, "aarav"), 1);
    assert.deepEqual(
      (await notes.getNotes(HASH)).map((c: { key: string }) => c.key),
      ["riya"]
    );
  });

  it("removes everything", async () => {
    await notes.saveChildNote(HASH, { childName: "Aarav" });
    assert.equal(await notes.forgetAllNotes(HASH), 1);
    assert.deepEqual(await notes.getNotes(HASH), []);
  });
});

describe("the three tools", () => {
  it("only ever act on the number in the chat, never on one the model names", async () => {
    await notes.saveChildNote("hash-someone-else", { childName: "Secret", age: 10 });

    await tool("note_child_details").execute(
      { childName: "Mine", phoneHash: "hash-someone-else" },
      { phoneHash: HASH }
    );
    const mine = await tool("get_my_notes").execute(
      { phoneHash: "hash-someone-else" },
      { phoneHash: HASH }
    );
    assert.deepEqual(
      mine.children.map((c: { child: string }) => c.child),
      ["Mine"]
    );
    assert.ok(!JSON.stringify(mine).includes("Secret"));

    await tool("forget_child_note").execute({ everything: true }, { phoneHash: HASH });
    assert.equal(
      (await notes.getNotes("hash-someone-else")).length,
      1,
      "the other number is untouched"
    );
  });

  it("save nothing for a number that has an account, and say where to add a child", async () => {
    for (const [name, args] of [
      ["note_child_details", { childName: "Aarav" }],
      ["get_my_notes", {}],
      ["forget_child_note", { everything: true }],
    ] as const) {
      const out = await tool(name).execute(args, { userId: "u1", phoneHash: HASH });
      assert.equal(out.reason, "has_account");
      assert.match(out.instruction, /dashboard/);
    }
    assert.deepEqual(await notes.getNotes(HASH), []);
  });

  it("do nothing outside a WhatsApp chat", async () => {
    const out = await tool("note_child_details").execute({ childName: "Aarav" }, {});
    assert.equal(out.reason, "no_chat");
  });

  it("note_child_details says it was a fifth child, and what to do", async () => {
    for (const name of ["Aa", "Bb", "Cc", "Dd"]) {
      await tool("note_child_details").execute({ childName: name }, { phoneHash: HASH });
    }
    const out = await tool("note_child_details").execute({ childName: "Ee" }, { phoneHash: HASH });
    assert.equal(out.saved, false);
    assert.match(out.instruction, /only four/);
  });

  it("get_my_notes says plainly when nothing is noted, and forget says when nothing matched", async () => {
    const none = await tool("get_my_notes").execute({}, { phoneHash: HASH });
    assert.deepEqual(none.children, []);
    assert.match(none.instruction, /Nothing has been noted/);

    const missed = await tool("forget_child_note").execute(
      { childName: "Nobody" },
      { phoneHash: HASH }
    );
    assert.equal(missed.removed, "nothing");
  });
});

describe("in the WhatsApp assistant", () => {
  const PHONE = "919812345678";
  const msg = (text: string, id = "wamid.1") => ({ id, from: PHONE, type: "text", text });

  type Seen = { systemPrompt: string; toolContext: unknown };
  const stub = (seen: Seen[]) =>
    async function* (
      systemPrompt: string,
      _history: unknown[],
      _user: string,
      toolContext: unknown
    ) {
      seen.push({ systemPrompt, toolContext });
      yield "Hello.";
    };

  it("gives a number with no account the phone hash for its notes, and no user", async () => {
    const seen: Seen[] = [];
    await answerWhatsAppMessage(msg("hi"), stub(seen));
    assert.deepEqual(seen[0]!.toolContext, { phoneHash: hashPhone(PHONE) });
    assert.match(seen[0]!.systemPrompt, /Remembering what they tell you/);
  });

  it("puts what a returning parent already said in the prompt, so they are not asked twice", async () => {
    await notes.saveChildNote(hashPhone(PHONE), {
      childName: "Vikrant",
      age: 14,
      sports: ["Tennis"],
      goal: "state level",
    });
    const seen: Seen[] = [];
    await answerWhatsAppMessage(msg("hello again"), stub(seen));
    assert.match(seen[0]!.systemPrompt, /What this parent has already told you/);
    assert.match(seen[0]!.systemPrompt, /Vikrant: 14 years old; plays or is considering Tennis/);
    assert.match(seen[0]!.systemPrompt, /goal: state level/);
  });

  it("does not put notes in the prompt of a parent who has an account", async () => {
    await notes.saveChildNote(hashPhone(PHONE), { childName: "Vikrant" });
    await User.create({
      name: "Meera Kapoor",
      email: "notes-parent@example.com",
      phone: "9812345678",
      password: "Passw0rd!x",
      role: "Parent",
    });
    const seen: Seen[] = [];
    const answer = await answerWhatsAppMessage(msg("hello"), stub(seen));
    assert.ok(!seen[0]!.systemPrompt.includes("What this parent has already told you"));
    assert.equal(answer.known, true);
  });

  it("deletes the notes together with the chat on STOP", async () => {
    await answerWhatsAppMessage(msg("hello"), stub([]));
    await notes.saveChildNote(hashPhone(PHONE), { childName: "Vikrant" });

    const stopped = await answerWhatsAppMessage(msg("STOP", "wamid.2"), stub([]));
    assert.match(stopped.reply, /anything I had noted about your children/);
    assert.equal(await WhatsAppConversation.countDocuments({}), 0);
    assert.equal(await WhatsAppNote.countDocuments({}), 0);
  });

  it("builds the same notes block for the eval as for production", () => {
    const block = identityAddendum(false, null, [
      { key: "riya", firstName: "Riya", sports: ["Swimming"], notedAt: new Date() },
    ]);
    assert.match(block, /Riya: plays or is considering Swimming/);
  });
});
