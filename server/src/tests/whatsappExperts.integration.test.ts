// The expert booking hand-off: links on search results, and one expert's public listing with the
// next open times and the link where the parent books. Real (in-memory) MongoDB, no network, no
// model. What matters as much as what is returned is what is not: nothing private about an expert.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";
process.env.FRONTEND_URL = "https://site.example.test";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { User } = require("../client/models/User");
const { Expert } = require("../client/models/ExpertProfile");
const { ExpertSession } = require("../client/models/ExpertBooking");
const { ASSISTANT_CHAT_TOOLS } = require("../shared/services/chatToolsService");
const { getExpertOpenSlots } = require("../client/services/ExpertsService/discovery");
const redis = require("../config/redis").default;

let mongod: { getUri(): string; stop(): Promise<void> };

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  await Promise.all([
    User.collection.deleteMany({}),
    Expert.deleteMany({}),
    ExpertSession.deleteMany({}),
  ]);
});

const oid = () => new mongoose.Types.ObjectId();
const tool = (name: string) => ASSISTANT_CHAT_TOOLS.find((t: { name: string }) => t.name === name);
const details = (args: Record<string, unknown>) => tool("get_expert_details").execute(args);

/** Open every day, 9 to 12 Indian time, so there are always slots in the next two weeks. */
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  start: "09:00",
  end: "12:00",
}));

const makeExpert = async (name: string, over: Record<string, unknown> = {}) => {
  const userId = oid();
  await User.collection.insertOne({
    _id: userId,
    name,
    email: `${name.replace(/\W/g, "").toLowerCase()}-private@example.test`,
    phone: `98${Math.floor(10000000 + Math.random() * 89999999)}`,
    role: "EXPERT",
    isActive: true,
    status: "ACTIVE",
  });
  return Expert.create({
    userId,
    bio: "Former state-level player who coaches juniors.",
    sports: ["Badminton"],
    expertise: ["Junior development"],
    achievements: "State champion 2015",
    sessionFee: 800,
    sessionMode: "ONLINE",
    sessionDurationMinutes: 45,
    timezone: "Asia/Kolkata",
    weeklyAvailability: EVERY_DAY,
    city: "Bangalore",
    languages: ["English", "Hindi"],
    inPersonAddress: "12 Secret Lane, Bangalore",
    isActive: true,
    verificationStatus: "APPROVED",
    rating: 4.8,
    reviewCount: 31,
    ...over,
  });
};

describe("search_experts", () => {
  it("gives each expert a profile link on the website, with session length and languages", async () => {
    const asha = await makeExpert("Asha Verma");
    const out = await tool("search_experts").execute({ sport: "Badminton" });

    assert.equal(out.totalMatches, 1);
    const [e] = out.experts;
    assert.equal(e.name, "Asha Verma");
    assert.equal(e.profileUrl, `https://site.example.test/experts/${asha._id}`);
    assert.equal(e.sessionMinutes, 45);
    assert.deepEqual(e.languages, ["English", "Hindi"]);
    assert.equal(e.sessionFee, 800);
  });

  it("returns nothing private about an expert", async () => {
    await makeExpert("Asha Verma");
    const text = JSON.stringify(await tool("search_experts").execute({}));
    for (const secret of ["private@example.test", "Secret Lane", "payout", "photoKey"]) {
      assert.ok(!text.includes(secret), `${secret} must not be returned`);
    }
  });

  it("tells the assistant to give the link, to use the details tool, and that it cannot book", () => {
    const note = tool("search_experts").promptNote;
    assert.match(note, /profileUrl/);
    assert.match(note, /get_expert_details/);
    assert.match(note, /you cannot book/);
    assert.match(
      note,
      /https:\/\/powermysport\.com\/experts/,
      "a full link, never a relative path"
    );
  });
});

describe("get_expert_details: finding the expert", () => {
  it("finds an expert by the id from a search result", async () => {
    const asha = await makeExpert("Asha Verma");
    const out = await details({ expert: String(asha._id) });
    assert.equal(out.found, true);
    assert.equal(out.expert.name, "Asha Verma");
    assert.equal(out.profileUrl, `https://site.example.test/experts/${asha._id}`);
  });

  it("finds an expert by full name, or by a part of it, in any case", async () => {
    await makeExpert("Asha Verma");
    await makeExpert("Rohit Menon", { sports: ["Football"], city: "Pune" });
    for (const said of ["Asha Verma", "asha", "VERMA", "  asha  "]) {
      const out = await details({ expert: said });
      assert.equal(out.found, true, said);
      assert.equal(out.expert.name, "Asha Verma", said);
    }
  });

  it("prefers the expert whose name matches over one whose bio happens to mention it", async () => {
    await makeExpert("Asha Verma");
    await makeExpert("Rohit Menon", { bio: "Trained under Asha for years." });
    const out = await details({ expert: "Asha" });
    assert.equal(out.found, true);
    assert.equal(out.expert.name, "Asha Verma");
  });

  it("asks which when several match, naming up to three with their links", async () => {
    for (const name of ["Asha Sharma", "Ravi Sharma", "Meena Sharma", "Dev Sharma"]) {
      await makeExpert(name);
    }
    const out = await details({ expert: "Sharma" });
    assert.equal(out.found, false);
    assert.equal(out.reason, "which_expert");
    assert.equal(out.options.length, 3);
    for (const option of out.options) {
      assert.match(option.profileUrl, /^https:\/\/site\.example\.test\/experts\/[a-f0-9]{24}$/);
    }
    assert.match(out.instruction, /Do not guess/);
  });

  it("says so when nobody matches, and points to the experts page", async () => {
    await makeExpert("Asha Verma");
    const out = await details({ expert: "Nobody Atall" });
    assert.equal(out.found, false);
    assert.equal(out.reason, "not_found");
    assert.match(out.instruction, /https:\/\/site\.example\.test\/experts/);
  });

  it("asks which expert when none was named", async () => {
    for (const expert of ["", "   ", undefined]) {
      assert.equal((await details({ expert })).reason, "which_expert");
    }
  });

  it("does not find an expert who is not active, by name or by id", async () => {
    const hidden = await makeExpert("Hidden Person", { isActive: false });
    assert.equal((await details({ expert: "Hidden" })).found, false);
    assert.equal((await details({ expert: String(hidden._id) })).found, false);
  });

  it("treats an id that exists nowhere, or text that is not an id, as a name and does not throw", async () => {
    await makeExpert("Asha Verma");
    assert.equal((await details({ expert: String(oid()) })).found, false);
    assert.equal((await details({ expert: "not-a-valid-id-at-all" })).found, false);
    assert.equal((await details({ expert: "$ne: null" })).found, false);
  });
});

describe("get_expert_details: what comes back", () => {
  it("returns the public listing: fee in rupees, session length, mode, languages, rating", async () => {
    await makeExpert("Asha Verma");
    const { expert } = await details({ expert: "Asha" });

    assert.equal(expert.name, "Asha Verma");
    assert.equal(expert.city, "Bangalore");
    assert.deepEqual(expert.sports, ["Badminton"]);
    assert.equal(expert.feePerSessionRupees, 800);
    assert.equal(expert.sessionMinutes, 45);
    assert.equal(expert.mode, "online");
    assert.deepEqual(expert.languages, ["English", "Hindi"]);
    assert.equal(expert.rating, 4.8);
    assert.equal(expert.reviewCount, 31);
    assert.match(expert.about, /state-level player/);
    assert.equal(expert.achievements, "State champion 2015");
  });

  it("words the mode for a parent", async () => {
    await makeExpert("Online One", { sessionMode: "ONLINE" });
    await makeExpert("Local Two", { sessionMode: "IN_PERSON" });
    await makeExpert("Both Three", { sessionMode: "BOTH" });
    assert.equal((await details({ expert: "Online One" })).expert.mode, "online");
    assert.equal((await details({ expert: "Local Two" })).expert.mode, "in person");
    assert.equal((await details({ expert: "Both Three" })).expert.mode, "online or in person");
  });

  it("returns nothing private: no email, phone, address or payout details", async () => {
    await makeExpert("Asha Verma");
    const text = JSON.stringify(await details({ expert: "Asha" }));
    for (const secret of [
      "private@example.test",
      "Secret Lane",
      "inPersonAddress",
      "payout",
      "email",
    ]) {
      assert.ok(
        !text.toLowerCase().includes(secret.toLowerCase()),
        `${secret} must not be returned`
      );
    }
    assert.ok(!/\b98\d{8}\b/.test(text), "no phone number");
  });

  it("trims a long bio at a word, and caps the expertise list", async () => {
    await makeExpert("Asha Verma", {
      bio: "A very experienced coach. ".repeat(60),
      expertise: ["a", "b", "c", "d", "e", "f", "g", "h"],
    });
    const { expert } = await details({ expert: "Asha" });
    assert.ok(expert.about.length <= 510);
    assert.match(expert.about, /\.\.\.$/);
    assert.equal(expert.expertise.length, 6);
  });
});

describe("get_expert_details: open times", () => {
  const SLOT = /^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{1,2}:\d{2} (AM|PM)$/;

  it("lists at most five open times, in Indian time, soonest first", async () => {
    await makeExpert("Asha Verma");
    const out = await details({ expert: "Asha" });

    assert.equal(out.nextOpenSlots.length, 5);
    for (const slot of out.nextOpenSlots) assert.match(slot, SLOT);
    assert.equal(out.slotsNote, undefined);
  });

  it("does not offer a time that is already booked", async () => {
    const asha = await makeExpert("Asha Verma");
    const before = await details({ expert: "Asha" });
    const [first] = await getExpertOpenSlots(String(asha._id));

    await ExpertSession.create({
      expertId: asha._id,
      userId: oid(),
      amount: 800,
      status: "SCHEDULED",
      paymentStatus: "COMPLETED",
      merchantOrderId: `order-${Math.random().toString(36).slice(2)}`,
      durationMinutes: 45,
      mode: "ONLINE",
      expertAcceptance: "ACCEPTED",
      refundStatus: "NONE",
      payoutStatus: "PENDING",
      scheduledAt: new Date(first.start),
    });

    const after = await details({ expert: "Asha" });
    assert.notEqual(after.nextOpenSlots[0], before.nextOpenSlots[0], "the booked time is gone");
  });

  it("says plainly when there are no open times", async () => {
    await makeExpert("Asha Verma", { weeklyAvailability: [] });
    const out = await details({ expert: "Asha" });
    assert.deepEqual(out.nextOpenSlots, []);
    assert.match(out.slotsNote, /No open slots in the next two weeks/);
  });
});

describe("get_expert_details: the hand-off to the website", () => {
  it("gives the link and tells the assistant it cannot book, hold or take payment", async () => {
    const asha = await makeExpert("Asha Verma");
    const out = await details({ expert: "Asha" });

    assert.equal(out.profileUrl, `https://site.example.test/experts/${asha._id}`);
    assert.match(out.instruction, /profile link on its own line/);
    assert.match(out.instruction, /you cannot book, hold a slot or take a payment/);
    assert.match(out.instruction, /open now but not held/);
    assert.match(out.instruction, /not regular coaching/);
  });

  it("works for anyone, with no account or chat behind it", async () => {
    await makeExpert("Asha Verma");
    // No context at all: a number with no account asking about an expert is a normal case.
    const out = await tool("get_expert_details").execute({ expert: "Asha" });
    assert.equal(out.found, true);
  });

  it("is registered and described to the model as unable to book", () => {
    assert.ok(tool("get_expert_details"));
    assert.match(tool("get_expert_details").description, /cannot book anything/);
    assert.match(tool("get_expert_details").promptNote, /you cannot book/);
  });
});
